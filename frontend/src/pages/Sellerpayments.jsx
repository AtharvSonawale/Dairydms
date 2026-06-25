import { useAppConfig } from '../context/AppConfigContext';
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Wallet, ChevronDown, ChevronUp, RefreshCw, Printer,
    BadgeCheck, AlertTriangle, X, Users, Milk,
    CheckCircle2, Clock, Search, Banknote, TrendingUp,
    FileSearch, Hash, FileText, Trash2, Calendar, Download
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// Import for PDF generation
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

// Compute all cycles from a seed date
const computeCycles = (seedFrom, daysPerCycle, count = 50) => {
    const cycles = [];
    const seed = new Date(seedFrom + 'T00:00:00');
    for (let i = 0; i < count; i++) {
        const start = new Date(seed);
        start.setDate(start.getDate() + i * daysPerCycle);
        const end = new Date(start);
        end.setDate(end.getDate() + daysPerCycle - 1);
        cycles.push({ from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] });
    }
    return cycles;
};

// Get the cycle that contains today
const getActiveCycle = (seedFrom, daysPerCycle) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cycles = computeCycles(seedFrom, daysPerCycle, 200);
    return cycles.find(c => {
        const s = new Date(c.from + 'T00:00:00');
        const e = new Date(c.to + 'T00:00:00');
        return today >= s && today <= e;
    }) || null;
};

// ── Fixed monthly cycles: 1–10, 11–20, 21–end of month ─────────
const pad2 = (n) => String(n).padStart(2, "0");

const getFixedMonthCycles = (refDate) => {
    const y = refDate.getFullYear();
    const m = refDate.getMonth(); // 0-indexed
    const lastDay = new Date(y, m + 1, 0).getDate();
    const ymd = (yr, mo, day) => `${yr}-${pad2(mo + 1)}-${pad2(day)}`;
    return [
        { label: "1–10", from: ymd(y, m, 1), to: ymd(y, m, 10) },
        { label: "11–20", from: ymd(y, m, 11), to: ymd(y, m, 20) },
        { label: `21–${lastDay}`, from: ymd(y, m, 21), to: ymd(y, m, lastDay) },
    ];
};

// Returns the fixed cycle (of the 3) that contains the given date
const getActiveFixedCycle = (refDate = new Date()) => {
    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);
    const cycles = getFixedMonthCycles(today);
    return cycles.find(c => {
        const s = new Date(c.from + 'T00:00:00');
        const e = new Date(c.to + 'T00:00:00');
        return today >= s && today <= e;
    }) || cycles[0];
};

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function CycleConfigModal({ open, onClose, onSave, initialSeed, initialDays, computeCycles }) {
    const { t } = useTranslation();
    const [localSeed, setLocalSeed] = useState(initialSeed);
    const [localDays, setLocalDays] = useState(initialDays);
    if (!open) return null;
    const previewCycles = computeCycles(localSeed, Math.max(1, localDays), 6);
    const handleSave = () => onSave(localSeed, Math.max(1, localDays));
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                            <BadgeCheck size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">{t('sellerPayments.configureCycle')}</h2>
                            <p className="text-[10px] text-gray-400">{t('sellerPayments.cycleConfigDesc')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                        <X size={15} />
                    </button>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <AlertTriangle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: t('sellerPayments.cycleInfo', {
                                    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                })
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.seedStartDate')}</label>
                            <input type="date" value={localSeed} onChange={e => setLocalSeed(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.daysPerCycle')}</label>
                            <input type="number" min={1} max={31} value={localDays}
                                onChange={e => setLocalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('sellerPayments.upcomingCycles')}</p>
                        <div className="flex flex-col gap-1.5">
                            {previewCycles.map((c, i) => {
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const s = new Date(c.from + 'T00:00:00');
                                const e = new Date(c.to + 'T00:00:00');
                                const isCurrent = today >= s && today <= e;
                                const isPayDay = today.getTime() === e.getTime();
                                const isPast = e < today;
                                return (
                                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${isCurrent ? 'border-violet-200 bg-violet-50' : 'border-gray-100 bg-gray-50'}`}>
                                        <span className="text-[10px] text-gray-400 font-medium min-w-[52px]">Cycle {i + 1}</span>
                                        <span className="flex-1 font-medium text-gray-700">
                                            {s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → {e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-200 text-violet-700 font-semibold">current</span>}
                                        </span>
                                        {isPayDay
                                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Payment day — today!</span>
                                            : isCurrent ? <span className="text-[10px] text-violet-500">{t('sellerPayments.payOn', { date: e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) })}</span>
                                                : isPast ? <span className="text-[10px] text-gray-400">{t('sellerPayments.past')}</span>
                                                    : <span className="text-[10px] text-gray-400">{t('sellerPayments.upcoming')}</span>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">{t('sellerPayments.cancel')}</button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition">
                        <BadgeCheck size={12} />{t('sellerPayments.saveCycleConfig')}</button>
                </div>
            </div>
        </div>
    );
}

function ExcelConfigModal({ open, onClose, showFlash }) {
    const [config, setConfig] = useState({
        plant_code: 'DAIRYCMS',
        code: 'RPAY',
        payment_mode: 'NEFT',
        dairy_acc_no: '1111111111',
        code2: 'M',
    });
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        if (!open) return;
        const fetch = async () => {
            try {
                const { data } = await api.get('/payments/excel-config');
                if (data) {
                    setConfig(data);
                    setIsEditing(false);
                } else {
                    setIsEditing(true);
                }
            } catch {
                setIsEditing(true);
            } finally {
                setIsLoaded(true);
            }
        };
        fetch();
    }, [open]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await api.post('/payments/excel-config', config);
            showFlash('success', 'Excel config saved successfully!');
            setIsEditing(false);
        } catch {
            showFlash('error', 'Failed to save config.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!open) return null;

    const fields = [
        { key: 'plant_code', label: 'Plant Code', placeholder: 'DAIRYCMS' },
        { key: 'code', label: 'Code', placeholder: 'RPAY' },
        { key: 'payment_mode', label: 'Payment Mode', placeholder: 'NEFT' },
        { key: 'dairy_acc_no', label: 'Dairy Current Acc No.', placeholder: '1111111111' },
        { key: 'code2', label: 'Code2', placeholder: 'M' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center">
                            <Download size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Excel Export Config</h2>
                            <p className="text-[10px] text-gray-400">Configure NEFT/RTGS export fields</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                        <X size={15} />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 flex flex-col gap-4">
                    {!isLoaded ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-5 h-5 border-2 border-gray-200 border-t-emerald-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <>
                            {!isEditing && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100 text-xs text-emerald-700 font-medium">
                                    <BadgeCheck size={13} />
                                    Config saved. Click Edit to modify.
                                </div>
                            )}
                            <div className="flex flex-col gap-3">
                                {fields.map(({ key, label, placeholder }) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            {label}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={config[key] || ''}
                                                placeholder={placeholder}
                                                onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                                    focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
                                            />
                                        ) : (
                                            <div className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-sm font-mono text-gray-700">
                                                {config[key] || <span className="text-gray-300">—</span>}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                        Cancel
                    </button>
                    {isLoaded && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gray-800 text-white hover:bg-gray-700 transition">
                            <RefreshCw size={12} /> Edit
                        </button>
                    )}
                    {isLoaded && isEditing && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50">
                            {isSaving
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <BadgeCheck size={12} />}
                            {isSaving ? 'Saving...' : 'Save Config'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SellerPayments() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const { can, loading: permLoading } = usePermission();

    const { appName } = useAppConfig();

    // AFTER
    const [customFrom, setCustomFrom] = useState(null);
    const [customTo, setCustomTo] = useState(null);

    const [billListExpanded, setBillListExpanded] = useState(true);


    const [combinedDownloading, setCombinedDownloading] = useState(false);
    const cycle = { from: customFrom, to: customTo };
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [paying, setPaying] = useState(null);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [filterPaid, setFilterPaid] = useState("all");
    // bill search
    const [billSearchOpen, setBillSearchOpen] = useState(false);
    const [billQuery, setBillQuery] = useState("");
    const [billResults, setBillResults] = useState([]);
    const [billDetail, setBillDetail] = useState(null);
    const [billLoading, setBillLoading] = useState(false);
    const [billDetailLoading, setBillDetailLoading] = useState(false);
    const [deletingBill, setDeletingBill] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [undoing, setUndoing] = useState(null);
    const [simulatedToday, setSimulatedToday] = useState(() => new Date().toISOString().split('T')[0]);


    const [cycleConfigOpen, setCycleConfigOpen] = useState(false);
    const [excelConfigOpen, setExcelConfigOpen] = useState(false);
    const [cycleSeedFrom, setCycleSeedFrom] = useState(new Date().toISOString().split('T')[0]);
    const [cycleDaysPerCycle, setCycleDaysPerCycle] = useState(10);
    const [cycleConfigLoaded, setCycleConfigLoaded] = useState(false);

    // Fixed monthly cycles (1-10 / 11-20 / 21-end) are the default.
    // The custom/rolling seed+days cycle is an optional override.
    const [useCustomCycle, setUseCustomCycle] = useState(false);
    const fixedCycles = getFixedMonthCycles(new Date());
    const [activeFixedIdx, setActiveFixedIdx] = useState(() => {
        const active = getActiveFixedCycle();
        const idx = getFixedMonthCycles(new Date()).findIndex(c => c.from === active.from && c.to === active.to);
        return idx >= 0 ? idx : 0;
    });

    const selectFixedCycle = (idx) => {
        const cycles = getFixedMonthCycles(new Date());
        const c = cycles[idx];
        if (!c) return;
        setActiveFixedIdx(idx);
        setCustomFrom(c.from);
        setCustomTo(c.to);
    };

    // Fetch cycle config from DB on mount (only applied if user later enables custom mode)
    useEffect(() => {
        const fetchCycleConfig = async () => {
            try {
                const { data } = await api.get('/payments/cycle-config');
                if (data) {
                    const seed = data.seed_from.split('T')[0];
                    const days = data.days_per_cycle;
                    setCycleSeedFrom(seed);
                    setCycleDaysPerCycle(days);
                }
            } catch (err) {
                console.error("Failed to fetch cycle config:", err);
            } finally {
                const active = getActiveFixedCycle();
                setCustomFrom(active.from);
                setCustomTo(active.to);
                setCycleConfigLoaded(true);
            }
        };
        fetchCycleConfig();
    }, []);

    // When custom cycle config changes WHILE custom mode is on, jump to its active cycle
    useEffect(() => {
        if (!useCustomCycle) return;
        const active = getActiveCycle(cycleSeedFrom, cycleDaysPerCycle);
        if (active) {
            setCustomFrom(active.from);
            setCustomTo(active.to);
        }
    }, [cycleSeedFrom, cycleDaysPerCycle, useCustomCycle]);

    // Toggling the mode switches the active date range accordingly
    const handleCycleModeToggle = (toCustom) => {
        setUseCustomCycle(toCustom);
        if (toCustom) {
            const active = getActiveCycle(cycleSeedFrom, cycleDaysPerCycle);
            if (active) { setCustomFrom(active.from); setCustomTo(active.to); }
        } else {
            selectFixedCycle(activeFixedIdx);
        }
    };

    const isTodayPaymentDay = (cycleFrom, cycleTo) => {
        const today = new Date(simulatedToday + 'T00:00:00');
        today.setHours(0, 0, 0, 0);
        const end = new Date(cycleTo + 'T00:00:00');
        return today.getTime() === end.getTime();
    };


    const searchBills = async (q) => {
        setBillLoading(true);
        try {
            const url = q.trim()
                ? `/payments/bills/search?q=${encodeURIComponent(q)}`
                : `/payments/bills/search?q=`;
            const { data } = await api.get(url);
            setBillResults(data);
        } catch { setBillResults([]); }
        finally { setBillLoading(false); }
    };

    const loadBillDetail = async (bill_no) => {
        setBillDetailLoading(true);
        setBillDetail(null);
        try {
            const { data } = await api.get(`/payments/bill/${bill_no}`);
            setBillDetail(data);
        } catch { showFlash("error", t('sellerPayments.billNotFound')); }
        finally { setBillDetailLoading(false); }
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startSellerPaymentsTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="header-actions"]',
                    popover: { title: t('sellerPayments.pageTitle'), description: 'Search past bills, configure your payment cycle, or export everything to Excel from here.' },
                },
                {
                    element: '[data-tour="date-range"]',
                    popover: { title: t('sellerPayments.from'), description: 'This is the active payment cycle. The payment date controls when "Pay" buttons unlock.' },
                },
                {
                    element: '[data-tour="payment-stats"]',
                    popover: { title: t('sellerPayments.totalSellers'), description: 'Quick totals for this cycle — milk amount, advances, and product deductions.' },
                },
                {
                    element: '[data-tour="seller-list"]',
                    popover: { title: t('sellerPayments.cashToPay'), description: 'Click a seller to expand their full breakdown. Use "Pay" to settle, or "PDF" to print a receipt after payment.' },
                },
            ],
        });
        driverObj.drive();
    };

    // fetch
    const fetchPayments = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(
                `/payments/seller-summary?from=${cycle.from}&to=${cycle.to}`
            );
            setSellers(data);
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('sellerPayments.loadError'));
        } finally {
            setLoading(false);
        }
        // AFTER
    }, [customFrom, customTo, t]);
    useEffect(() => {
        if (!cycleConfigLoaded) return;
        fetchPayments();
    }, [fetchPayments, cycleConfigLoaded]);

    // generate deterministic preview bill_no
    const generatePreviewBillNo = (sellerId, fromDate, toDate) => {
        const from = new Date(fromDate);
        const to = new Date(toDate || fromDate);
        const month = String(from.getMonth() + 1).padStart(2, '0');
        const year = String(from.getFullYear()).slice(-2);
        const toDay = String(to.getDate()).padStart(2, '0');
        const sellerSuffix = String(sellerId).padStart(4, '0');
        return `${month}${year}${toDay}${sellerSuffix}`;
    };

    // mark paid
    const handleMarkPaid = async (e, sellerId) => {
        e.stopPropagation();
        if (paying) return;
        setPaying(sellerId);

        const seller = sellers.find(s => s.seller_id === sellerId);
        if (!seller) return;

        const depositAmount = parseFloat(seller.total_milk_quantity || 0) * parseFloat(seller.deposit_per_litre || 0);
        const installmentCut = seller.advance_given > 0
            ? (seller.deduction_amount > 0 ? Math.min(seller.deduction_amount, seller.advance_given) : seller.advance_given)
            : 0;

        const bill_no = generatePreviewBillNo(sellerId, cycle.from, cycle.to);

        try {
            const { data: paidData } = await api.post("/payments/mark-paid", {
                seller_id: sellerId,
                from_date: cycle.from,
                to_date: cycle.to,
                installment_cut: installmentCut,
                deposit_amount: depositAmount,
                bill_no,
            });

            const confirmedBillNo = paidData?.bill_no || bill_no;
            showFlash("success", t('sellerPayments.paidSuccess', { billNo: confirmedBillNo }));
            await fetchPayments();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('sellerPayments.paidError'));
        } finally {
            setPaying(null);
        }
    };

    const handleUndo = async (e, seller) => {
        e.stopPropagation();
        if (undoing || !seller.bill_no) return;
        setUndoing(seller.seller_id);
        try {
            await api.delete(`/payments/bill/${seller.bill_no}`);
            showFlash("success", t('sellerPayments.undoSuccess', { name: seller.name, billNo: seller.bill_no }));
            await fetchPayments();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('sellerPayments.undoError'));
        } finally {
            setUndoing(null);
        }
    };

    const toggleExpand = (id) =>
        setExpanded(p => ({ ...p, [id]: !p[id] }));

    // ── PDF Generation Functions ──────────────────────────────────

    // Generate PDF from HTML content
    const generateReceiptPDF = async (htmlContent, fileName) => {
        try {
            // Create a temporary container with exact A4 dimensions
            const container = document.createElement('div');
            container.innerHTML = htmlContent;
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '794px'; // A4 width in pixels at 96dpi
            container.style.background = 'white';
            container.style.padding = '20px';
            container.style.zIndex = '-9999';
            container.style.fontSize = '11px';
            container.style.fontFamily = 'Arial, sans-serif';
            container.style.color = '#000000'; // Force black text for B&W
            document.body.appendChild(container);

            // Wait for fonts/layout to settle
            await new Promise(resolve => setTimeout(resolve, 800));

            // Render to canvas with high quality
            const canvas = await html2canvas(container, {
                scale: 2.5, // Higher quality
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 794,
                height: container.scrollHeight,
                onclone: (clonedDoc) => {
                    // Force all text to be black in the cloned document
                    const allElements = clonedDoc.querySelectorAll('*');
                    allElements.forEach(el => {
                        const computedStyle = window.getComputedStyle(el);
                        const color = computedStyle.color;
                        // Only override if it's not white or transparent
                        if (color !== 'rgb(255, 255, 255)' && color !== 'transparent') {
                            el.style.color = '#000000';
                        }
                    });
                }
            });

            // Remove container
            document.body.removeChild(container);

            // Create PDF with exact A4 dimensions
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            // Add first page
            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            // Add subsequent pages if needed
            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            // Save PDF
            pdf.save(fileName);
            return true;
        } catch (error) {
            console.error('PDF generation error:', error);
            return false;
        }
    };

    // ── Add this function after generateReceiptPDF (around line 530) ──
    // Generate combined PDF with all receipts
    const generateCombinedPDF = async (sellersList) => {
        try {
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = 210; // A4 width in mm
            const pageHeight = 297; // A4 height in mm

            let isFirstPage = true;
            let successCount = 0;
            let failCount = 0;

            for (let index = 0; index < sellersList.length; index++) {
                const seller = sellersList[index];

                // Update progress every 5 sellers
                if (index % 5 === 0 && index > 0) {
                    showFlash("info", `Processing ${index + 1}/${sellersList.length} receipts...`);
                }

                try {
                    // Generate HTML for this seller
                    const html = await buildReceiptHtml(seller);
                    if (!html) {
                        failCount++;
                        continue;
                    }

                    // Create temporary container
                    const container = document.createElement('div');
                    container.innerHTML = html;
                    container.style.position = 'fixed';
                    container.style.left = '-9999px';
                    container.style.top = '0';
                    container.style.width = '794px';
                    container.style.background = 'white';
                    container.style.padding = '20px';
                    container.style.zIndex = '-9999';
                    container.style.fontSize = '11px';
                    container.style.fontFamily = 'Arial, sans-serif';
                    container.style.color = '#000000';
                    document.body.appendChild(container);

                    // Wait for layout
                    await new Promise(resolve => setTimeout(resolve, 800));

                    // Render to canvas
                    const canvas = await html2canvas(container, {
                        scale: 2.5,
                        useCORS: true,
                        logging: false,
                        backgroundColor: '#ffffff',
                        width: 794,
                        height: container.scrollHeight,
                        onclone: (clonedDoc) => {
                            const allElements = clonedDoc.querySelectorAll('*');
                            allElements.forEach(el => {
                                const computedStyle = window.getComputedStyle(el);
                                const color = computedStyle.color;
                                if (color !== 'rgb(255, 255, 255)' && color !== 'transparent') {
                                    el.style.color = '#000000';
                                }
                            });
                        }
                    });

                    // Remove container
                    document.body.removeChild(container);

                    // Calculate image dimensions
                    const imgWidth = pageWidth - 20; // 10mm margins on each side
                    const imgHeight = (canvas.height * imgWidth) / canvas.width;

                    // Add new page if not first page
                    if (!isFirstPage) {
                        pdf.addPage();
                    }
                    isFirstPage = false;

                    // Add image to PDF
                    const imgData = canvas.toDataURL('image/jpeg', 0.98);
                    pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);

                    successCount++;

                } catch (err) {
                    console.error(`Error processing seller ${seller.seller_id}:`, err);
                    failCount++;
                }
            }

            // Save the combined PDF
            if (successCount > 0) {
                const fromDate = cycle.from ? new Date(cycle.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/[/, ]/g, '_') : 'draft';
                const toDate = cycle.to ? new Date(cycle.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/[/, ]/g, '_') : 'draft';
                const fileName = `Combined_Receipts_${fromDate}_to_${toDate}.pdf`;
                pdf.save(fileName);
                return { successCount, failCount };
            } else {
                return { successCount: 0, failCount: sellersList.length };
            }

        } catch (error) {
            console.error('Combined PDF generation error:', error);
            return { successCount: 0, failCount: sellersList.length };
        }
    };

    // Build receipt HTML (returns HTML string)
    const buildReceiptHtml = async (seller, overrideCycle) => {
        const activeCycle = overrideCycle || cycle;

        let billData;
        if (seller.bill_no) {
            try {
                const { data } = await api.get(`/payments/bill/${seller.bill_no}`);
                billData = data;
            } catch {
                return null;
            }
        }

        const entries = billData?.entries || seller.entries || [];
        const productSales = billData?.productSales || [];
        const walkinSales = billData?.walkinSales || [];

        const sellerObj = {
            ...seller,
            entries,
            product_deduction: billData?.payment?.product_deduction ?? seller.product_deduction,
            walkin_deduction: billData?.payment?.walkin_deduction ?? seller.walkin_deduction,
            installment_cut: billData?.payment?.installment_cut ?? seller.installment_cut,
            deposit_amount: billData?.payment?.deposit_amount ?? seller.deposit_amount,
            deposit_per_litre: billData?.payment?.deposit_per_litre ?? seller.deposit_per_litre,
            total_milk_quantity: entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0),
            advance_given: billData?.depositSnapshot?.[0] != null
                ? (billData?.payment?.advance_given ?? seller.advance_given)
                : seller.advance_given,
            opening_deposit: seller.bill_no
                ? (billData?.depositSnapshot?.[0]?.deposit_balance_before ?? 0)
                : (seller.deposit_balance ?? 0),
            final_payable: billData?.payment?.final_payable ?? billData?.payment?.cash_paid ?? seller.final_payable,
            cash_to_pay: billData?.payment?.cash_paid ?? seller.cash_to_pay,
            is_paid: true,
            paid_at: billData?.payment?.paid_at || seller.paid_at,
            bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, activeCycle.from, activeCycle.to),
        };

        const milkAmt = parseFloat(sellerObj.milk_amount || 0);
        const depositAmt = parseFloat(sellerObj.deposit_amount || 0);
        const installmentCut = parseFloat(sellerObj.installment_cut || 0);
        const productDed = parseFloat(sellerObj.product_deduction || 0);
        const walkinDed = parseFloat(sellerObj.walkin_deduction || 0);
        const advGiven = parseFloat(sellerObj.advance_given || 0);
        const openingDeposit = parseFloat(sellerObj.opening_deposit || 0);
        const finalPayable = parseFloat(sellerObj.final_payable || sellerObj.cash_to_pay || 0);

        const closingAdvance = Math.max(0, advGiven - installmentCut);
        const closingDeposit = openingDeposit + depositAmt;

        const totalQty = entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const cowQty = entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const buffaloQty = entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const avgFat = entries.length ? (entries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / entries.length).toFixed(2) : "0.00";
        const avgSnf = entries.length ? (entries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / entries.length).toFixed(2) : "0.00";

        const morningEntries = entries.filter(e => e.shift === "morning");
        const eveningEntries = entries.filter(e => e.shift === "evening");
        const allDates = [...new Set(entries.map(e => e.entry_date?.split("T")[0]))].sort();

        const mQty = morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const eQty = eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const mAmt = morningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const eAmt = eveningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const mFat = morningEntries.length ? morningEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / morningEntries.length : 0;
        const eFat = eveningEntries.length ? eveningEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / eveningEntries.length : 0;
        const mSnf = morningEntries.length ? morningEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / morningEntries.length : 0;
        const eSnf = eveningEntries.length ? eveningEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / eveningEntries.length : 0;

        const fmtR = (n) => `Rs.${parseFloat(n || 0).toFixed(2)}`;
        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

        const buildRow = (date) => {
            const m = morningEntries.find(e => e.entry_date?.startsWith(date));
            const ev = eveningEntries.find(e => e.entry_date?.startsWith(date));
            const rowAmt = parseFloat(m?.total_amount || 0) + parseFloat(ev?.total_amount || 0);
            const dayStr = new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" });

            const cell = (e) => e
                ? `<td style="text-align:center">${parseFloat(e.quantity || 0).toFixed(2)}</td>
               <td style="text-align:center">${parseFloat(e.fat || 0).toFixed(1)}</td>
               <td style="text-align:center">${parseFloat(e.snf || 0).toFixed(1)}</td>
               <td style="text-align:center">${parseFloat(e.rate_applied || 0).toFixed(2)}</td>
               <td style="font-weight:600;text-align:right">${parseFloat(e.total_amount || 0).toFixed(2)}</td>`
                : `<td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:right">—</td>`;

            return `<tr>
            <td style="font-weight:600;background:#f8f8f8;text-align:center">${dayStr}</td>
            ${cell(m)}
            ${cell(ev)}
            <td style="font-weight:700;background:#f0f4ff;text-align:right">${rowAmt > 0 ? rowAmt.toFixed(2) : "—"}</td>
          </tr>`;
        };

        const productSalesTable = productSales.length > 0 ? `
    <div class="section-title">${t('sellerPayments.productSalesDeductions')}</div>
    <table style="margin-bottom:10px">
        <thead>
            <tr>
                <th style="text-align:left">${t('sellerPayments.product')}</th>
                <th>${t('sellerPayments.qty')}</th>
                <th>${t('sellerPayments.rate')}</th>
                <th>${t('sellerPayments.amount')}</th>
            </tr>
        </thead>
        <tbody>
            ${productSales.map((p, i) => `
                <tr style="background:${i % 2 === 0 ? '#f9f9f9' : '#ffffff'}">
                    <td style="text-align:left">${p.product_name || t('sellerPayments.unknown')}</td>
                    <td style="text-align:center">${parseFloat(p.quantity || 0).toFixed(2)} ${p.unit || ''}</td>
                    <td style="text-align:center">Rs.${parseFloat(p.rate || 0).toFixed(2)}</td>
                    <td style="font-weight:600;text-align:right">${fmtR(p.total_amount)}</td>
                  </tr>`).join('')}
            <tr style="background:#e8e8e8;font-weight:bold;border-top:2px solid #000">
                <td style="text-align:left" colspan="3">${t('sellerPayments.total')}</td>
                <td style="text-align:right">${fmtR(productDed)}</td>
              </tr>
        </tbody>
      </table>` : "";

        const walkinTotal = walkinDed > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:8px 12px; background:#f0f0f0; border:1px solid #000; 
                border-radius:6px; margin-bottom:10px">
        <span style="font-weight:600; color:#000">${t('sellerPayments.milkBoughtBySeller')}</span>
        <span style="font-weight:700; font-size:13px; color:#000">${fmtR(walkinDed)}</span>
    </div>` : "";

        return `<!DOCTYPE html>
<html>
<head>
    <title>${t('sellerPayments.paymentReceipt')} - ${sellerObj.name}</title>
    <style>
        * { 
            -webkit-print-color-adjust: exact !important; 
            print-color-adjust: exact !important; 
            color-adjust: exact !important;
            box-sizing: border-box;
        }
        body { 
            font-family: Arial, sans-serif; 
            font-size: 11px; 
            color: #000000 !important;
            margin: 0; 
            padding: 16px;
            background: #ffffff;
        }
        h1 { margin: 0; font-size: 16px; color: #000000 !important; }
        table { border-collapse: collapse; width: 100%; }
        th, td { 
            border: 1px solid #000000 !important;
            padding: 4px 6px; 
            text-align: center; 
            font-size: 10px;
            color: #000000 !important;
        }
        th { 
            background: #e0e0e0 !important;
            color: #000000 !important; 
            font-weight: 700;
            white-space: nowrap;
        }
        .section-title {
            font-size: 10px; 
            font-weight: bold; 
            text-transform: uppercase;
            letter-spacing: 0.5px; 
            color: #000000 !important;
            margin: 14px 0 4px; 
            border-bottom: 2px solid #000000 !important; 
            padding-bottom: 3px;
        }
        .info-grid {
            display: grid; 
            grid-template-columns: repeat(4,1fr); 
            gap: 6px 16px;
            background: #f0f0f0 !important;
            padding: 10px; 
            border-radius: 4px; 
            margin-bottom: 10px;
            border: 1px solid #000000 !important;
        }
        .info-item .lbl { 
            font-size: 9px; 
            color: #333333 !important; 
            text-transform: uppercase; 
        }
        .info-item .val { 
            font-size: 12px; 
            font-weight: bold; 
            color: #000000 !important;
            margin-top: 1px; 
        }
        .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(4,1fr); 
            gap: 6px; 
            margin-bottom: 10px; 
        }
        .summary-box { 
            border: 1px solid #000000 !important; 
            border-radius: 4px; 
            padding: 6px 8px;
            background: #fafafa !important;
        }
        .summary-box .lbl { 
            font-size: 9px; 
            color: #333333 !important; 
            text-transform: uppercase; 
        }
        .summary-box .val { 
            font-size: 13px; 
            font-weight: bold; 
            color: #000000 !important;
            margin-top: 2px; 
        }
        .summary-box .sub { 
            font-size: 9px; 
            color: #555555 !important; 
            margin-top: 2px; 
        }
        .bottom-summary {
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr; 
            gap: 0;
            border: 1px solid #000000 !important; 
            border-radius: 6px; 
            overflow: hidden; 
            margin-bottom: 10px;
        }
        .bs-col { padding: 0; }
        .bs-col-header {
            background: #d0d0d0 !important;
            color: #000000 !important; 
            font-size: 10px; 
            font-weight: bold;
            text-align: center; 
            padding: 5px 8px; 
            text-transform: uppercase; 
            letter-spacing: 0.4px;
            border-bottom: 1px solid #000000 !important;
        }
        .bs-row {
            display: flex; 
            justify-content: space-between;
            padding: 4px 10px; 
            border-bottom: 1px solid #cccccc !important; 
            font-size: 10px;
        }
        .bs-row:last-child { border-bottom: none; }
        .bs-row .key { color: #333333 !important; }
        .bs-row .val { 
            font-weight: 600; 
            font-family: monospace;
            color: #000000 !important;
        }
        .bs-col + .bs-col { border-left: 1px solid #000000 !important; }
        .bs-total-row {
            display: flex; 
            justify-content: space-between;
            padding: 6px 10px; 
            font-size: 11px; 
            font-weight: bold;
            border-top: 2px solid #000000 !important; 
            background: #e8e8e8 !important;
        }
        .bs-total-row span { color: #000000 !important; }
        .deduction-row {
            display: flex; 
            justify-content: space-between;
            padding: 5px 10px; 
            border-bottom: 1px solid #cccccc !important; 
            font-size: 11px;
        }
        .deduction-row span { color: #000000 !important; }
        .net-row {
            display: flex; 
            justify-content: space-between; 
            padding: 10px 12px;
            background: #333333 !important;
            color: #ffffff !important;
            font-size: 13px; 
            font-weight: bold;
            border: 1px solid #000000 !important;
        }
        .net-row span { color: #ffffff !important; }
        @media print {
            body { padding: 8px; }
            .no-print { display: none; }
            @page { size: A4 portrait; margin: 8mm; }
        }
    </style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;
            border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px">
    <div>
        <h1>${appName}</h1>
        <div style="font-size:10px;color:#333;margin-top:2px;">${t('sellerPayments.milkCollectionReceipt')}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#333">
        <div style="font-weight:bold;font-size:12px;color:#000">
            ${fmtD(activeCycle.from)} – ${fmtD(activeCycle.to)}
        </div>
        <div>${t('sellerPayments.billNo')}: <strong style="font-family:monospace;color:#000">${sellerObj.bill_no}</strong></div>
        <div>${t('sellerPayments.generated')}: ${fmtD(new Date().toISOString())}</div>
    </div>
</div>

<!-- Seller Info -->
<div class="info-grid">
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.sellerName')}</div>
        <div class="val">${sellerObj.name}</div>
    </div>
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.sellerCode')}</div>
        <div class="val" style="font-family:monospace">${sellerObj.seller_code}</div>
    </div>
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.totalEntries')}</div>
        <div class="val">${entries.length} ${t('sellerPayments.entries')}</div>
    </div>
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.status')}</div>
        <div class="val" style="color:#000">
            ${sellerObj.is_paid ? t('sellerPayments.paid') : t('sellerPayments.pending')}
            ${sellerObj.paid_at
                ? `<span style="font-size:9px;font-weight:normal;color:#333;display:block">${t('sellerPayments.on')} ${fmtD(sellerObj.paid_at)}</span>`
                : ""}
        </div>
    </div>
</div>

<!-- Top Summary Cards -->
<div class="summary-grid">
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.totalQty')}</div>
        <div class="val">${totalQty.toFixed(2)} L</div>
        <div class="sub">${t('sellerPayments.morning')}: ${mQty.toFixed(2)} L &nbsp;|&nbsp; ${t('sellerPayments.evening')}: ${eQty.toFixed(2)} L</div>
    </div>
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.cowBuffalo')}</div>
        <div class="val">${cowQty.toFixed(2)} / ${buffaloQty.toFixed(2)} L</div>
    </div>
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.avgFat')}</div>
        <div class="val">${avgFat}%</div>
        <div class="sub">${t('sellerPayments.morningShort')}: ${mFat.toFixed(1)} &nbsp;|&nbsp; ${t('sellerPayments.eveningShort')}: ${eFat.toFixed(1)}</div>
    </div>
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.avgSnf')}</div>
        <div class="val">${avgSnf}</div>
        <div class="sub">${t('sellerPayments.morningShort')}: ${mSnf.toFixed(1)} &nbsp;|&nbsp; ${t('sellerPayments.eveningShort')}: ${eSnf.toFixed(1)}</div>
    </div>
</div>

<!-- Day-wise Entry Table -->
${entries.length > 0 ? `
<div class="section-title">${t('sellerPayments.dailyEntryBreakdown')}</div>
<table style="margin-bottom:10px">
    <thead>
        <tr>
            <th rowspan="2" style="width:48px">${t('sellerPayments.date')}</th>
            <th colspan="5" style="background:#d0d0d0">${t('sellerPayments.morningShift')}</th>
            <th colspan="5" style="background:#c0c0c0">${t('sellerPayments.eveningShift')}</th>
            <th rowspan="2" style="background:#b0b0b0;width:64px">${t('sellerPayments.dayTotal')}</th>
          </tr>
          <tr>
            <th style="background:#d0d0d0">${t('sellerPayments.qtyL')}</th>
            <th style="background:#d0d0d0">${t('sellerPayments.fat')}</th>
            <th style="background:#d0d0d0">${t('sellerPayments.snf')}</th>
            <th style="background:#d0d0d0">${t('sellerPayments.rate')}</th>
            <th style="background:#d0d0d0">${t('sellerPayments.amt')}</th>
            <th style="background:#c0c0c0">${t('sellerPayments.qtyL')}</th>
            <th style="background:#c0c0c0">${t('sellerPayments.fat')}</th>
            <th style="background:#c0c0c0">${t('sellerPayments.snf')}</th>
            <th style="background:#c0c0c0">${t('sellerPayments.rate')}</th>
            <th style="background:#c0c0c0">${t('sellerPayments.amt')}</th>
          </tr>
    </thead>
    <tbody>
        ${allDates.map(buildRow).join("")}
        <tr style="background:#e8e8e8;font-weight:bold;border-top:2px solid #000">
            <td style="background:#e8e8e8">${t('sellerPayments.total')}</td>
            <td style="text-align:center">${mQty.toFixed(2)}</td>
            <td style="text-align:center">${mFat.toFixed(1)}</td>
            <td style="text-align:center">${mSnf.toFixed(1)}</td>
            <td style="text-align:center">—</td>
            <td style="color:#000;text-align:right">${mAmt.toFixed(2)}</td>
            <td style="text-align:center">${eQty.toFixed(2)}</td>
            <td style="text-align:center">${eFat.toFixed(1)}</td>
            <td style="text-align:center">${eSnf.toFixed(1)}</td>
            <td style="text-align:center">—</td>
            <td style="color:#000;text-align:right">${eAmt.toFixed(2)}</td>
            <td style="color:#000;background:#d0d0d0;text-align:right">${milkAmt.toFixed(2)}</td>
          </tr>
    </tbody>
</table>` : ""}

${productSalesTable}
${walkinTotal}

<div class="section-title">${t('sellerPayments.accountSummary')}</div>
<div class="bottom-summary">

    <!-- Column 1: Advance Account -->
    <div class="bs-col">
        <div class="bs-col-header">${t('sellerPayments.advanceAccount')}</div>
        <div class="bs-row">
            <span class="key">${t('sellerPayments.openingBalance')}</span>
            <span class="val">${fmtR(advGiven)}</span>
        </div>
        <div class="bs-row">
            <span class="key">${t('sellerPayments.givenThisCycle')}</span>
            <span class="val">Rs.0.00</span>
        </div>
        <div class="bs-row" style="background:#f5f5f5">
            <span class="key">${t('sellerPayments.installmentCut')}</span>
            <span class="val">− ${fmtR(installmentCut)}</span>
        </div>
        <div class="bs-total-row">
            <span>${t('sellerPayments.closingBalance')}</span>
            <span>${fmtR(closingAdvance)}</span>
        </div>
    </div>

    <!-- Column 2: Deposit Account -->
    <div class="bs-col">
        <div class="bs-col-header">${t('sellerPayments.depositAccount')}</div>
        <div class="bs-row">
            <span class="key">${t('sellerPayments.openingBalance')}</span>
            <span class="val">${fmtR(openingDeposit)}</span>
        </div>
        <div class="bs-row" style="background:#f0f0f0">
            <span class="key">${t('sellerPayments.addedThisCycle')}</span>
            <span class="val">+ ${fmtR(depositAmt)}</span>
        </div>
        <div class="bs-row">
            <span class="key">${parseFloat(sellerObj.total_milk_quantity || 0).toFixed(2)}L × Rs.${sellerObj.deposit_per_litre}/L</span>
            <span class="val" style="font-size:9px;color:#666">${t('sellerPayments.formula')}</span>
        </div>
        <div class="bs-total-row">
            <span>${t('sellerPayments.closingBalance')}</span>
            <span>${fmtR(closingDeposit)}</span>
        </div>
    </div>

    <!-- Column 3: Payment Summary -->
    <div class="bs-col">
        <div class="bs-col-header">${t('sellerPayments.paymentSummary')}</div>
        <div class="bs-row" style="background:#f0fdf4">
            <span class="key">${t('sellerPayments.milkAmount')}</span>
            <span class="val">+ ${fmtR(milkAmt)}</span>
        </div>
        ${depositAmt > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.depositCut')}</span>
            <span class="val">− ${fmtR(depositAmt)}</span>
        </div>` : ""}
        ${installmentCut > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.advInstallment')}</span>
            <span class="val">− ${fmtR(installmentCut)}</span>
        </div>` : ""}
        ${productDed > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.products')}</span>
            <span class="val">− ${fmtR(productDed)}</span>
        </div>` : ""}
        ${walkinDed > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.milkBought')}</span>
            <span class="val">− ${fmtR(walkinDed)}</span>
        </div>` : ""}
        <div class="bs-total-row" style="background:#333;color:#fff">
            <span style="color:#fff;font-weight:bold">${t('sellerPayments.netCashToHand')}</span>
            <span style="color:#fff;font-family:monospace;font-size:12px">${fmtR(finalPayable)}</span>
        </div>
    </div>

</div>

<div class="section-title">${t('sellerPayments.detailedBreakdown')}</div>
<div style="border:1px solid #000;border-radius:6px;overflow:hidden;margin-bottom:10px">
    <div class="deduction-row" style="background:#f0fdf4">
        <span>${t('sellerPayments.milkAmountPayable')}</span>
        <span style="font-weight:700;font-family:monospace;">+ ${fmtR(milkAmt)}</span>
    </div>
    ${advGiven > 0 ? `
    <div class="deduction-row" style="background:#faf5ff">
        <span>${t('sellerPayments.openingAdvanceBalance')}</span>
        <span style="font-family:monospace">${fmtR(advGiven)}</span>
    </div>` : ""}
    ${installmentCut > 0 ? `
    <div class="deduction-row" style="background:#fff5f5">
        <span>${t('sellerPayments.advanceInstallmentCut')} &nbsp;
            <span style="font-size:9px;color:#666">(${fmtR(advGiven)} → ${fmtR(closingAdvance)} ${t('sellerPayments.remaining')})</span>
        </span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(installmentCut)}</span>
    </div>` : ""}
    ${depositAmt > 0 ? `
    <div class="deduction-row" style="background:#eff6ff">
        <span>${t('sellerPayments.depositDeducted')} &nbsp;
            <span style="font-size:9px;color:#666">
                (${parseFloat(sellerObj.total_milk_quantity || 0).toFixed(2)}L × Rs.${sellerObj.deposit_per_litre}/L
                · ${t('sellerPayments.balance')}: ${fmtR(openingDeposit)} → ${fmtR(closingDeposit)})
            </span>
        </span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(depositAmt)}</span>
    </div>` : ""}
    ${productDed > 0 ? `
    <div class="deduction-row" style="background:#fffbeb">
        <span>${t('sellerPayments.productSalesDeduction')}</span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(productDed)}</span>
    </div>` : ""}
    ${walkinDed > 0 ? `
    <div class="deduction-row" style="background:#fff7ed">
        <span>${t('sellerPayments.milkBoughtBySellerWalkin')}</span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(walkinDed)}</span>
    </div>` : ""}
    <div class="net-row">
        <span>${t('sellerPayments.netCashToHand')}</span>
        <span style="font-family:monospace">${fmtR(finalPayable)}</span>
    </div>
</div>

<div style="display:flex;justify-content:space-between;font-size:9px;color:#666;
            border-top:1px solid #eee;padding-top:8px;margin-top:4px">
    <span>${t('sellerPayments.computerGenerated')} · ${appName}</span>
    ${sellerObj.is_paid && sellerObj.paid_at
                ? `<span>${t('sellerPayments.paidOn')}: ${fmtD(sellerObj.paid_at)}</span>`
                : ""}
</div>

</body>
</html>`;
    };

    // Downloads one receipt as PDF
    const downloadReceiptPDF = async (seller) => {
        try {
            const html = await buildReceiptHtml(seller);
            if (!html) {
                showFlash("error", t('sellerPayments.receiptGenerationError'));
                return false;
            }
            // Include from/to dates in filename
            const fromDate = cycle.from ? new Date(cycle.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/[/, ]/g, '_') : 'draft';
            const toDate = cycle.to ? new Date(cycle.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/[/, ]/g, '_') : 'draft';
            const fileName = `Receipt_${seller.seller_code || seller.seller_id}_${seller.bill_no || 'draft'}_${fromDate}_to_${toDate}.pdf`;
            const success = await generateReceiptPDF(html, fileName);
            if (success) {
                return true;
            } else {
                showFlash("error", t('sellerPayments.pdfGenerationError'));
                return false;
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            showFlash("error", t('sellerPayments.pdfGenerationError'));
            return false;
        }
    };

    // print receipt (Bill PDF) - for printing functionality
    const printReceipt = async (e, seller, overrideCycle) => {
        e.stopPropagation();
        const activeCycle = overrideCycle || cycle;

        let billData;
        if (seller.bill_no) {
            try {
                const { data } = await api.get(`/payments/bill/${seller.bill_no}`);
                billData = data;
            } catch (err) {
                showFlash("error", t('sellerPayments.printLoadError'));
                return;
            }
        }

        const entries = billData?.entries || seller.entries || [];
        const productSales = billData?.productSales || [];
        const walkinSales = billData?.walkinSales || [];

        const sellerObj = {
            ...seller,
            entries,
            product_deduction: billData?.payment?.product_deduction ?? seller.product_deduction,
            walkin_deduction: billData?.payment?.walkin_deduction ?? seller.walkin_deduction,
            installment_cut: billData?.payment?.installment_cut ?? seller.installment_cut,
            deposit_amount: billData?.payment?.deposit_amount ?? seller.deposit_amount,
            deposit_per_litre: billData?.payment?.deposit_per_litre ?? seller.deposit_per_litre,
            total_milk_quantity: entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0),
            advance_given: billData?.depositSnapshot?.[0] != null
                ? (billData?.payment?.advance_given ?? seller.advance_given)
                : seller.advance_given,
            opening_deposit: seller.bill_no
                ? (billData?.depositSnapshot?.[0]?.deposit_balance_before ?? 0)
                : (seller.deposit_balance ?? 0),
            final_payable: billData?.payment?.final_payable ?? billData?.payment?.cash_paid ?? seller.final_payable,
            cash_to_pay: billData?.payment?.cash_paid ?? seller.cash_to_pay,
            is_paid: true,
            paid_at: billData?.payment?.paid_at || seller.paid_at,
            bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, activeCycle.from, activeCycle.to),
        };

        const milkAmt = parseFloat(sellerObj.milk_amount || 0);
        const depositAmt = parseFloat(sellerObj.deposit_amount || 0);
        const installmentCut = parseFloat(sellerObj.installment_cut || 0);
        const productDed = parseFloat(sellerObj.product_deduction || 0);
        const walkinDed = parseFloat(sellerObj.walkin_deduction || 0);
        const advGiven = parseFloat(sellerObj.advance_given || 0);
        const openingDeposit = parseFloat(sellerObj.opening_deposit || 0);
        const finalPayable = parseFloat(sellerObj.final_payable || sellerObj.cash_to_pay || 0);

        const closingAdvance = Math.max(0, advGiven - installmentCut);
        const closingDeposit = openingDeposit + depositAmt;

        const totalQty = entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const cowQty = entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const buffaloQty = entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const avgFat = entries.length ? (entries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / entries.length).toFixed(2) : "0.00";
        const avgSnf = entries.length ? (entries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / entries.length).toFixed(2) : "0.00";

        const morningEntries = entries.filter(e => e.shift === "morning");
        const eveningEntries = entries.filter(e => e.shift === "evening");
        const allDates = [...new Set(entries.map(e => e.entry_date?.split("T")[0]))].sort();

        const mQty = morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const eQty = eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const mAmt = morningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const eAmt = eveningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
        const mFat = morningEntries.length ? morningEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / morningEntries.length : 0;
        const eFat = eveningEntries.length ? eveningEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / eveningEntries.length : 0;
        const mSnf = morningEntries.length ? morningEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / morningEntries.length : 0;
        const eSnf = eveningEntries.length ? eveningEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / eveningEntries.length : 0;

        const fmtR = (n) => `Rs.${parseFloat(n || 0).toFixed(2)}`;
        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

        const buildRow = (date) => {
            const m = morningEntries.find(e => e.entry_date?.startsWith(date));
            const ev = eveningEntries.find(e => e.entry_date?.startsWith(date));
            const rowAmt = parseFloat(m?.total_amount || 0) + parseFloat(ev?.total_amount || 0);
            const dayStr = new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit" });

            const cell = (e) => e
                ? `<td style="text-align:center">${parseFloat(e.quantity || 0).toFixed(2)}</td>
               <td style="text-align:center">${parseFloat(e.fat || 0).toFixed(1)}</td>
               <td style="text-align:center">${parseFloat(e.snf || 0).toFixed(1)}</td>
               <td style="text-align:center">${parseFloat(e.rate_applied || 0).toFixed(2)}</td>
               <td style="font-weight:600;text-align:right">${parseFloat(e.total_amount || 0).toFixed(2)}</td>`
                : `<td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:center">—</td><td style="text-align:right">—</td>`;

            return `<tr>
            <td style="font-weight:600;background:#f8f8f8;text-align:center">${dayStr}</td>
            ${cell(m)}
            ${cell(ev)}
            <td style="font-weight:700;background:#f0f4ff;text-align:right">${rowAmt > 0 ? rowAmt.toFixed(2) : "—"}</td>
          </tr>`;
        };

        const productSalesTable = productSales.length > 0 ? `
    <div class="section-title">${t('sellerPayments.productSalesDeductions')}</div>
    <table style="margin-bottom:10px">
        <thead>
            <tr>
                <th style="text-align:left">${t('sellerPayments.product')}</th>
                <th>${t('sellerPayments.qty')}</th>
                <th>${t('sellerPayments.rate')}</th>
                <th>${t('sellerPayments.amount')}</th>
            </tr>
        </thead>
        <tbody>
            ${productSales.map((p, i) => `
                <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
                    <td style="text-align:left">${p.product_name || t('sellerPayments.unknown')}</td>
                    <td style="text-align:center">${parseFloat(p.quantity || 0).toFixed(2)} ${p.unit || ''}</td>
                    <td style="text-align:center">Rs.${parseFloat(p.rate || 0).toFixed(2)}</td>
                    <td style="font-weight:600;text-align:right">${fmtR(p.total_amount)}</td>
                  </tr>`).join('')}
            <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #111">
                <td style="text-align:left" colspan="3">${t('sellerPayments.total')}</td>
                <td style="text-align:right">${fmtR(productDed)}</td>
              </tr>
        </tbody>
      </table>` : "";

        const walkinTotal = walkinDed > 0 ? `
    <div style="display:flex;justify-content:space-between;align-items:center;
                padding:8px 12px; background:#fff7ed; border:1px solid #fed7aa; 
                border-radius:6px; margin-bottom:10px">
        <span style="font-weight:600; color:#9a3412">${t('sellerPayments.milkBoughtBySeller')}</span>
        <span style="font-weight:700; font-size:13px; color:#ea580c">${fmtR(walkinDed)}</span>
    </div>` : "";

        const win = window.open("", "_blank", "width=900,height=900");
        if (!win) {
            showFlash("error", t('sellerPayments.popupBlocked'));
            return;
        }

        const htmlContent = `<!DOCTYPE html>
<html>
<head>
    <title>${t('sellerPayments.paymentReceipt')} - ${sellerObj.name}</title>
    <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 16px; }
        h1  { margin: 0; font-size: 16px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: center; font-size: 10px; }
        th { background: #111; color: #fff; font-weight: 600; white-space: nowrap; }
        .section-title {
            font-size: 10px; font-weight: bold; text-transform: uppercase;
            letter-spacing: 0.5px; color: #555;
            margin: 14px 0 4px; border-bottom: 1px solid #ddd; padding-bottom: 3px;
        }
        .info-grid {
            display: grid; grid-template-columns: repeat(4,1fr); gap: 6px 16px;
            background: #f8f8f8; padding: 10px; border-radius: 4px; margin-bottom: 10px;
        }
        .info-item .lbl { font-size: 9px; color: #888; text-transform: uppercase; }
        .info-item .val { font-size: 12px; font-weight: bold; margin-top: 1px; }
        .summary-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 6px; margin-bottom: 10px; }
        .summary-box { border: 1px solid #ddd; border-radius: 4px; padding: 6px 8px; }
        .summary-box .lbl { font-size: 9px; color: #888; text-transform: uppercase; }
        .summary-box .val { font-size: 13px; font-weight: bold; margin-top: 2px; }
        .summary-box .sub { font-size: 9px; color: #888; margin-top: 2px; }
        .bottom-summary {
            display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0;
            border: 1px solid #ccc; border-radius: 6px; overflow: hidden; margin-bottom: 10px;
        }
        .bs-col { padding: 0; }
        .bs-col-header {
            background: #111; color: #fff; font-size: 10px; font-weight: bold;
            text-align: center; padding: 5px 8px; text-transform: uppercase; letter-spacing: 0.4px;
        }
        .bs-row {
            display: flex; justify-content: space-between;
            padding: 4px 10px; border-bottom: 1px solid #f0f0f0; font-size: 10px;
        }
        .bs-row:last-child { border-bottom: none; }
        .bs-row .key { color: #555; }
        .bs-row .val { font-weight: 600; font-family: monospace; }
        .bs-col + .bs-col { border-left: 1px solid #ccc; }
        .bs-total-row {
            display: flex; justify-content: space-between;
            padding: 6px 10px; font-size: 11px; font-weight: bold;
            border-top: 2px solid #ccc; background: #f8f8f8;
        }
        .deduction-row {
            display: flex; justify-content: space-between;
            padding: 5px 10px; border-bottom: 1px solid #f0f0f0; font-size: 11px;
        }
        .net-row {
            display: flex; justify-content: space-between; padding: 10px 12px;
            background: #111; color: #fff; font-size: 13px; font-weight: bold;
        }
        @media print {
            body { padding: 8px; }
            .no-print { display: none; }
            @page { size: A4 portrait; margin: 10mm; }
        }
    </style>
</head>
<body>

<!-- Header -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;
            border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px">
    <div>
        <h1>${appName}</h1>
        <div style="font-size:10px;color:#555;margin-top:2px;">${t('sellerPayments.milkCollectionReceipt')}</div>
    </div>
    <div style="text-align:right;font-size:10px;color:#555">
        <div style="font-weight:bold;font-size:12px;color:#111">
            ${fmtD(activeCycle.from)} – ${fmtD(activeCycle.to)}
        </div>
        <div>${t('sellerPayments.billNo')}: <strong style="font-family:monospace;color:#111">${sellerObj.bill_no}</strong></div>
        <div>${t('sellerPayments.generated')}: ${fmtD(new Date().toISOString())}</div>
    </div>
</div>

<!-- Seller Info -->
<div class="info-grid">
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.sellerName')}</div>
        <div class="val">${sellerObj.name}</div>
    </div>
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.sellerCode')}</div>
        <div class="val" style="font-family:monospace">${sellerObj.seller_code}</div>
    </div>
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.totalEntries')}</div>
        <div class="val">${entries.length} ${t('sellerPayments.entries')}</div>
    </div>
    <div class="info-item">
        <div class="lbl">${t('sellerPayments.status')}</div>
        <div class="val" style="color:${sellerObj.is_paid ? '#16a34a' : '#d97706'}">
            ${sellerObj.is_paid ? t('sellerPayments.paid') : t('sellerPayments.pending')}
            ${sellerObj.paid_at
                ? `<span style="font-size:9px;font-weight:normal;color:#555;display:block">${t('sellerPayments.on')} ${fmtD(sellerObj.paid_at)}</span>`
                : ""}
        </div>
    </div>
</div>

<!-- Top Summary Cards -->
<div class="summary-grid">
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.totalQty')}</div>
        <div class="val">${totalQty.toFixed(2)} L</div>
        <div class="sub">${t('sellerPayments.morning')}: ${mQty.toFixed(2)} L &nbsp;|&nbsp; ${t('sellerPayments.evening')}: ${eQty.toFixed(2)} L</div>
    </div>
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.cowBuffalo')}</div>
        <div class="val">${cowQty.toFixed(2)} / ${buffaloQty.toFixed(2)} L</div>
    </div>
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.avgFat')}</div>
        <div class="val">${avgFat}%</div>
        <div class="sub">${t('sellerPayments.morningShort')}: ${mFat.toFixed(1)} &nbsp;|&nbsp; ${t('sellerPayments.eveningShort')}: ${eFat.toFixed(1)}</div>
    </div>
    <div class="summary-box">
        <div class="lbl">${t('sellerPayments.avgSnf')}</div>
        <div class="val">${avgSnf}</div>
        <div class="sub">${t('sellerPayments.morningShort')}: ${mSnf.toFixed(1)} &nbsp;|&nbsp; ${t('sellerPayments.eveningShort')}: ${eSnf.toFixed(1)}</div>
    </div>
</div>

<!-- Day-wise Entry Table -->
${entries.length > 0 ? `
<div class="section-title">${t('sellerPayments.dailyEntryBreakdown')}</div>
<table style="margin-bottom:10px">
    <thead>
        <tr>
            <th rowspan="2" style="width:48px">${t('sellerPayments.date')}</th>
            <th colspan="5" style="background:#1d4ed8">${t('sellerPayments.morningShift')}</th>
            <th colspan="5" style="background:#4338ca">${t('sellerPayments.eveningShift')}</th>
            <th rowspan="2" style="background:#1e3a5f;width:64px">${t('sellerPayments.dayTotal')}</th>
          </tr>
          <tr>
            <th style="background:#1d4ed8">${t('sellerPayments.qtyL')}</th>
            <th style="background:#1d4ed8">${t('sellerPayments.fat')}</th>
            <th style="background:#1d4ed8">${t('sellerPayments.snf')}</th>
            <th style="background:#1d4ed8">${t('sellerPayments.rate')}</th>
            <th style="background:#1d4ed8">${t('sellerPayments.amt')}</th>
            <th style="background:#4338ca">${t('sellerPayments.qtyL')}</th>
            <th style="background:#4338ca">${t('sellerPayments.fat')}</th>
            <th style="background:#4338ca">${t('sellerPayments.snf')}</th>
            <th style="background:#4338ca">${t('sellerPayments.rate')}</th>
            <th style="background:#4338ca">${t('sellerPayments.amt')}</th>
          </tr>
    </thead>
    <tbody>
        ${allDates.map(buildRow).join("")}
        <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #111">
            <td style="background:#f0f0f0">${t('sellerPayments.total')}</td>
            <td style="text-align:center">${mQty.toFixed(2)}</td>
            <td style="text-align:center">${mFat.toFixed(1)}</td>
            <td style="text-align:center">${mSnf.toFixed(1)}</td>
            <td style="text-align:center">—</td>
            <td style="color:#1d4ed8;text-align:right">${mAmt.toFixed(2)}</td>
            <td style="text-align:center">${eQty.toFixed(2)}</td>
            <td style="text-align:center">${eFat.toFixed(1)}</td>
            <td style="text-align:center">${eSnf.toFixed(1)}</td>
            <td style="text-align:center">—</td>
            <td style="color:#4338ca;text-align:right">${eAmt.toFixed(2)}</td>
            <td style="color:#111;background:#e0e7ff;text-align:right">${milkAmt.toFixed(2)}</td>
          </tr>
    </tbody>
</table>` : ""}

${productSalesTable}
${walkinTotal}

<div class="section-title">${t('sellerPayments.accountSummary')}</div>
<div class="bottom-summary">
    <div class="bs-col">
        <div class="bs-col-header" style="background:#7c3aed">${t('sellerPayments.advanceAccount')}</div>
        <div class="bs-row">
            <span class="key">${t('sellerPayments.openingBalance')}</span>
            <span class="val" style="color:#7c3aed">${fmtR(advGiven)}</span>
        </div>
        <div class="bs-row">
            <span class="key">${t('sellerPayments.givenThisCycle')}</span>
            <span class="val">Rs.0.00</span>
        </div>
        <div class="bs-row" style="background:#fff5f5">
            <span class="key">${t('sellerPayments.installmentCut')}</span>
            <span class="val" style="color:#dc2626">− ${fmtR(installmentCut)}</span>
        </div>
        <div class="bs-total-row" style="background:#f5f3ff">
            <span style="color:#7c3aed;font-weight:bold">${t('sellerPayments.closingBalance')}</span>
            <span style="color:#7c3aed;font-family:monospace">${fmtR(closingAdvance)}</span>
        </div>
    </div>
    <div class="bs-col">
        <div class="bs-col-header" style="background:#1d4ed8">${t('sellerPayments.depositAccount')}</div>
        <div class="bs-row">
            <span class="key">${t('sellerPayments.openingBalance')}</span>
            <span class="val" style="color:#1d4ed8">${fmtR(openingDeposit)}</span>
        </div>
        <div class="bs-row" style="background:#eff6ff">
            <span class="key">${t('sellerPayments.addedThisCycle')}</span>
            <span class="val" style="color:#15803d">+ ${fmtR(depositAmt)}</span>
        </div>
        <div class="bs-row">
            <span class="key">${parseFloat(sellerObj.total_milk_quantity || 0).toFixed(2)}L × Rs.${sellerObj.deposit_per_litre}/L</span>
            <span class="val" style="font-size:9px;color:#888">${t('sellerPayments.formula')}</span>
        </div>
        <div class="bs-total-row" style="background:#eff6ff">
            <span style="color:#1d4ed8;font-weight:bold">${t('sellerPayments.closingBalance')}</span>
            <span style="color:#1d4ed8;font-family:monospace">${fmtR(closingDeposit)}</span>
        </div>
    </div>
    <div class="bs-col">
        <div class="bs-col-header" style="background:#15803d">${t('sellerPayments.paymentSummary')}</div>
        <div class="bs-row" style="background:#f0fdf4">
            <span class="key">${t('sellerPayments.milkAmount')}</span>
            <span class="val" style="color:#15803d">+ ${fmtR(milkAmt)}</span>
        </div>
        ${depositAmt > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.depositCut')}</span>
            <span class="val" style="color:#dc2626">− ${fmtR(depositAmt)}</span>
        </div>` : ""}
        ${installmentCut > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.advInstallment')}</span>
            <span class="val" style="color:#dc2626">− ${fmtR(installmentCut)}</span>
        </div>` : ""}
        ${productDed > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.products')}</span>
            <span class="val" style="color:#d97706">− ${fmtR(productDed)}</span>
        </div>` : ""}
        ${walkinDed > 0 ? `
        <div class="bs-row">
            <span class="key">${t('sellerPayments.milkBought')}</span>
            <span class="val" style="color:#ea580c">− ${fmtR(walkinDed)}</span>
        </div>` : ""}
        <div class="bs-total-row" style="background:#111;color:#fff">
            <span style="font-weight:bold">${t('sellerPayments.netCashToHand')}</span>
            <span style="font-family:monospace;font-size:12px">${fmtR(finalPayable)}</span>
        </div>
    </div>
</div>

<div class="section-title">${t('sellerPayments.detailedBreakdown')}</div>
<div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:10px">
    <div class="deduction-row" style="background:#f0fdf4">
        <span>${t('sellerPayments.milkAmountPayable')}</span>
        <span style="font-weight:700;font-family:monospace;color:#15803d">+ ${fmtR(milkAmt)}</span>
    </div>
    ${advGiven > 0 ? `
    <div class="deduction-row" style="color:#7c3aed;background:#faf5ff">
        <span>${t('sellerPayments.openingAdvanceBalance')}</span>
        <span style="font-family:monospace">${fmtR(advGiven)}</span>
    </div>` : ""}
    ${installmentCut > 0 ? `
    <div class="deduction-row" style="color:#dc2626;background:#fff5f5">
        <span>${t('sellerPayments.advanceInstallmentCut')} &nbsp;
            <span style="font-size:9px;color:#aaa">(${fmtR(advGiven)} → ${fmtR(closingAdvance)} ${t('sellerPayments.remaining')})</span>
        </span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(installmentCut)}</span>
    </div>` : ""}
    ${depositAmt > 0 ? `
    <div class="deduction-row" style="color:#1d4ed8;background:#eff6ff">
        <span>${t('sellerPayments.depositDeducted')} &nbsp;
            <span style="font-size:9px;color:#aaa">
                (${parseFloat(sellerObj.total_milk_quantity || 0).toFixed(2)}L × Rs.${sellerObj.deposit_per_litre}/L
                · ${t('sellerPayments.balance')}: ${fmtR(openingDeposit)} → ${fmtR(closingDeposit)})
            </span>
        </span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(depositAmt)}</span>
    </div>` : ""}
    ${productDed > 0 ? `
    <div class="deduction-row" style="color:#d97706;background:#fffbeb">
        <span>${t('sellerPayments.productSalesDeduction')}</span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(productDed)}</span>
    </div>` : ""}
    ${walkinDed > 0 ? `
    <div class="deduction-row" style="color:#ea580c;background:#fff7ed">
        <span>${t('sellerPayments.milkBoughtBySellerWalkin')}</span>
        <span style="font-family:monospace;font-weight:600">− ${fmtR(walkinDed)}</span>
    </div>` : ""}
    <div class="net-row">
        <span>${t('sellerPayments.netCashToHand')}</span>
        <span style="font-family:monospace">${fmtR(finalPayable)}</span>
    </div>
</div>

<div style="display:flex;justify-content:space-between;font-size:9px;color:#aaa;
            border-top:1px solid #eee;padding-top:8px;margin-top:4px">
    <span>${t('sellerPayments.computerGenerated')} · ${appName}</span>
    ${sellerObj.is_paid && sellerObj.paid_at
                ? `<span>${t('sellerPayments.paidOn')}: ${fmtD(sellerObj.paid_at)}</span>`
                : ""}
</div>

<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

        win.document.write(htmlContent);
        win.document.close();
    };

    // Bulk download PDFs
    const [bulkDownloading, setBulkDownloading] = useState(false);

    const handleBulkDownloadPDFs = async () => {
        const paidSellers = sellers.filter(s => !!(s.is_paid || s.bill_no) && parseFloat(s.milk_amount || 0) > 0);
        if (paidSellers.length === 0) {
            showFlash("error", t('sellerPayments.noPaidSellersToDownload') || "No paid sellers to download.");
            return;
        }
        setBulkDownloading(true);
        let successCount = 0;
        let failCount = 0;
        try {
            // Show progress toast
            showFlash("info", `Preparing ${paidSellers.length} PDF receipts...`);

            for (let index = 0; index < paidSellers.length; index++) {
                const seller = paidSellers[index];
                const sellerWithBillNo = {
                    ...seller,
                    bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, cycle.from, cycle.to),
                };

                // Update progress every 5 downloads
                if (index % 5 === 0 && index > 0) {
                    showFlash("info", `Downloading ${index + 1}/${paidSellers.length} receipts...`);
                }

                const success = await downloadReceiptPDF(sellerWithBillNo);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
                // Small delay between downloads to prevent browser blocking
                await new Promise(r => setTimeout(r, 600));
            }

            if (failCount === 0) {
                showFlash("success", t('sellerPayments.bulkDownloadSuccess', { count: successCount }) || `Downloaded ${successCount} receipt(s).`);
            } else {
                showFlash("warning", `Downloaded ${successCount} receipt(s), ${failCount} failed. Check console for errors.`);
            }
        } catch (err) {
            console.error('Bulk download error:', err);
            showFlash("error", t('sellerPayments.bulkDownloadError') || "Some receipts failed to download.");
        } finally {
            setBulkDownloading(false);
        }
    };

    // ── Add this function after handleBulkDownloadPDFs (around line 700) ──
    const handleCombinedDownload = async () => {
        const paidSellers = sellers.filter(s => !!(s.is_paid || s.bill_no) && parseFloat(s.milk_amount || 0) > 0);
        if (paidSellers.length === 0) {
            showFlash("error", t('sellerPayments.noPaidSellersToDownload') || "No paid sellers to download.");
            return;
        }

        // Confirm with user for large downloads
        if (paidSellers.length > 20) {
            if (!window.confirm(`This will combine ${paidSellers.length} receipts into a single PDF. This may take a moment. Continue?`)) {
                return;
            }
        }

        setCombinedDownloading(true);
        try {
            showFlash("info", `Preparing combined PDF with ${paidSellers.length} receipts...`);

            // Prepare seller data with bill numbers
            const sellersWithBillNo = paidSellers.map(seller => ({
                ...seller,
                bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, cycle.from, cycle.to),
            }));

            const result = await generateCombinedPDF(sellersWithBillNo);

            if (result.successCount > 0) {
                if (result.failCount === 0) {
                    showFlash("success", `Combined PDF generated successfully with ${result.successCount} receipts!`);
                } else {
                    showFlash("warning", `Combined PDF generated with ${result.successCount} receipts, ${result.failCount} failed.`);
                }
            } else {
                showFlash("error", "Failed to generate combined PDF. Please try again.");
            }

        } catch (err) {
            console.error('Combined download error:', err);
            showFlash("error", "Failed to generate combined PDF.");
        } finally {
            setCombinedDownloading(false);
        }
    };

    const printBillReceipt = async (billDetailOrSummary) => {
        let detail = billDetailOrSummary;
        if (!detail.entries || detail.entries.length === 0) {
            try {
                const { data } = await api.get(`/payments/bill/${detail.payment?.bill_no || billDetailOrSummary.bill_no}`);
                detail = data;
            } catch {
                showFlash("error", t('sellerPayments.printLoadError'));
                return;
            }
        }

        const { payment, entries = [] } = detail;

        const installmentCutAmt = parseFloat(payment.installment_cut || 0);
        const depositAddedAmt = parseFloat(payment.deposit_amount || 0);
        const advanceGivenAmt = parseFloat(payment.advance_given || 0);
        const openingDepositAmt = parseFloat(detail.depositSnapshot?.[0]?.deposit_balance_before ?? payment.opening_deposit ?? 0);

        const openingAdvanceAmt = advanceGivenAmt;

        const sellerObj = {
            ...payment,
            name: payment.name,
            seller_code: payment.seller_code,
            bill_no: payment.bill_no,
            milk_amount: payment.milk_amount,
            advance_given: openingAdvanceAmt,
            installment_cut: installmentCutAmt,
            deposit_amount: depositAddedAmt,
            deposit_per_litre: payment.deposit_per_litre,
            opening_deposit: openingDepositAmt,
            total_milk_quantity: entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0),
            product_deduction: payment.product_deduction,
            walkin_deduction: payment.walkin_deduction,
            final_payable: payment.final_payable ?? payment.cash_paid,
            cash_to_pay: payment.cash_paid,
            is_paid: true,
            paid_at: payment.paid_at,
            entries: entries,
        };

        const cycleObj = { from: payment.from_date, to: payment.to_date };
        printReceipt({ stopPropagation: () => { } }, sellerObj, cycleObj);
    };

    const handleDeleteBill = (bill_no) => {
        setDeletingBill(bill_no);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteBill = async () => {
        if (!deletingBill || deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/payments/bill/${deletingBill}`);
            showFlash("success", t('sellerPayments.deleteSuccess', { billNo: deletingBill }));
            setBillResults(prev => prev.filter(b => b.bill_no !== deletingBill));
            if (billDetail?.payment?.bill_no === deletingBill) setBillDetail(null);
            await fetchPayments();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('sellerPayments.deleteError'));
        } finally {
            setDeleting(false);
            setDeleteConfirmOpen(false);
            setDeletingBill(null);
        }
    };

    const cancelDeleteBill = () => {
        setDeleteConfirmOpen(false);
        setDeletingBill(null);
    };

    // Print Register
    const printRegister = () => {
        const fmtR = (n) => parseFloat(n || 0).toFixed(2);
        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";

        const activePrintSellers = sellers.filter(s => parseFloat(s.milk_amount || 0) > 0);

        const sellerRows = activePrintSellers.map((s, i) => {
            const milkAmt = parseFloat(s.milk_amount || 0);
            const advGiven = parseFloat(s.advance_given || 0) + parseFloat(s.installment_cut || 0);
            const installmentCut = parseFloat(s.installment_cut || 0);
            const depositAmt = parseFloat(s.deposit_amount || 0);
            const productDed = parseFloat(s.product_deduction || 0);
            const walkinDed = parseFloat(s.walkin_deduction || 0);
            const finalPayable = parseFloat(s.final_payable || s.cash_to_pay || 0);
            const totalQty = (s.entries || []).reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
            const billNo = s.bill_no || "N/A";

            const advClosing = Math.max(0, advGiven - installmentCut);
            const depositOpening = Math.max(0, parseFloat(s.deposit_balance ?? 0) - depositAmt);
            const depositClosing = depositOpening + depositAmt;
            const pendTotal = productDed + walkinDed;

            const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
            const subBg = i % 2 === 0 ? "#f3f4f6" : "#eef0f3";

            // ── Main seller row ──────────────────────────────────────
            const mainRow = `
<tr style="background:${bg};border-top:2px solid #9ca3af">
    <td style="padding:5px 7px;border:1px solid #d1d5db;font-family:monospace;font-size:10px;
               color:#374151;font-weight:700;vertical-align:top;white-space:nowrap">
        ${s.seller_code || "—"}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;font-weight:700;font-size:11px;
               vertical-align:top;white-space:nowrap">
        ${s.name}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;text-align:right;
               font-family:monospace;vertical-align:top">
        ${totalQty.toFixed(1)}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;text-align:right;
               font-family:monospace;color:#15803d;font-weight:600;vertical-align:top">
        ${fmtR(milkAmt)}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;text-align:right;
               font-family:monospace;vertical-align:top">
        ${advGiven > 0 ? fmtR(advGiven) : ""}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;text-align:right;
               font-family:monospace;text-decoration:underline;vertical-align:top">
        ${installmentCut > 0 ? fmtR(installmentCut) : ""}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;text-align:right;
               font-family:monospace;vertical-align:top">
        ${advGiven > 0 ? fmtR(advClosing) : ""}
    </td>
    <td style="padding:5px 7px;border:1px solid #d1d5db;text-align:right;
               font-family:monospace;font-weight:700;font-size:11px;vertical-align:top;
               color:${finalPayable > 0 ? "#15803d" : "#374151"}">
        ${fmtR(finalPayable)}
    </td>
</tr>`;

            // ── Advance sub-row ──────────────────────────────────────
            const advRow = `
<tr style="background:${subBg}">
    <td style="padding:1px 7px 1px 10px;border-left:1px solid #d1d5db;border-right:none;
               font-size:9px;color:#6b7280;text-align:right;font-style:italic;white-space:nowrap">
        Advance:
    </td>
    <td style="padding:1px 7px;border-right:1px solid #d1d5db;font-size:9px;
               font-family:monospace;color:#7c3aed">
        ${advGiven > 0
                    ? `<span style="margin-right:10px">${fmtR(advGiven)}</span><span style="margin-right:10px">${fmtR(installmentCut)}</span><span>${fmtR(advClosing)}</span>`
                    : `<span style="color:#d1d5db">—</span>`}
    </td>
    <td colspan="6" style="border-right:1px solid #d1d5db;border-bottom:none"></td>
</tr>`;

            // ── Pending sub-row ──────────────────────────────────────
            const pendRow = `
<tr style="background:${subBg}">
    <td style="padding:1px 7px 1px 10px;border-left:1px solid #d1d5db;border-right:none;
               font-size:9px;color:#6b7280;text-align:right;font-style:italic;white-space:nowrap">
        Product Bought:
    </td>
    <td style="padding:1px 7px;border-right:1px solid #d1d5db;font-size:9px;
               font-family:monospace;color:#d97706">
        ${pendTotal > 0
                    ? `${productDed > 0 ? `<span style="margin-right:10px">${fmtR(productDed)}</span>` : ""}${walkinDed > 0 ? `<span style="margin-right:10px">${fmtR(walkinDed)}</span>` : ""}<span>${fmtR(pendTotal)}</span>`
                    : `<span style="color:#d1d5db">—</span>`}
    </td>
    <td colspan="6" style="border-right:1px solid #d1d5db;border-bottom:none"></td>
</tr>`;

            // ── Deposit sub-row ──────────────────────────────────────
            const depRow = `
<tr style="background:${subBg};border-bottom:1px solid #d1d5db">
    <td style="padding:1px 7px 3px 10px;border-left:1px solid #d1d5db;border-right:none;
               font-size:9px;color:#6b7280;text-align:right;font-style:italic;white-space:nowrap">
        Deposit:
    </td>
    <td style="padding:1px 7px 3px;border-right:1px solid #d1d5db;font-size:9px;
               font-family:monospace;color:#2563eb">
        ${depositAmt > 0 || depositOpening > 0
                    ? `<span style="margin-right:10px">${fmtR(depositOpening)}</span><span style="margin-right:10px">${fmtR(depositAmt)}</span><span>${fmtR(depositClosing)}</span>`
                    : `<span style="color:#d1d5db">—</span>`}
    </td>
    <td colspan="6" style="border-right:1px solid #d1d5db"></td>
</tr>`;

            return mainRow + advRow + pendRow + depRow;
        }).join("");

        // ── Grand totals ─────────────────────────────────────────────
        const grandQty = activePrintSellers.reduce((a, s) => a + (s.entries || []).reduce((b, e) => b + parseFloat(e.quantity || 0), 0), 0);
        const grandMilk = activePrintSellers.reduce((a, s) => a + parseFloat(s.milk_amount || 0), 0);
        const grandAdv = activePrintSellers.reduce((a, s) => a + parseFloat(s.advance_given || 0), 0);
        const grandInstallment = activePrintSellers.reduce((a, s) => parseFloat(s.advance_given || 0) > 0 ? a + parseFloat(s.installment_cut || 0) : a, 0);
        const grandAdvBalance = Math.max(0, grandAdv - grandInstallment);
        const grandFinal = activePrintSellers.reduce((a, s) => a + parseFloat(s.final_payable || s.cash_to_pay || 0), 0);

        const win = window.open("", "_blank", "width=1100,height=900");
        if (!win) { showFlash("error", t('sellerPayments.popupBlocked')); return; }

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>${t('sellerPayments.paymentRegister')} - ${fmtD(cycle.from)} to ${fmtD(cycle.to)}</title>
    <style>
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #111; margin: 0; padding: 0; }
        table { border-collapse: collapse; width: 100%; }
        @media print { @page { size: A4 portrait; margin: 8mm; } body { font-size: 10px; } }
        @media screen { body { max-width: 900px; margin: 0 auto; padding: 16px; } }
    </style>
</head>
<body>

<!-- Header -->
<div style="text-align:center;margin-bottom:10px">
    <div style="font-size:16px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase">${appName}</div>
    <div style="font-size:11px;color:#374151;margin-top:2px">
        Payment Register For The Period From :
        ${new Date(cycle.from + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
        &nbsp; To &nbsp;
        ${new Date(cycle.to + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })}
    </div>
</div>

<!-- Section label (like "01 : KUMBHAR DAIRY" in the image) -->
<div style="font-size:11px;font-weight:700;color:#111;margin-bottom:4px;padding:3px 6px;
            border-top:1px solid #111;border-bottom:1px solid #111;background:#f3f4f6">
    ${appName}
</div>

<table style="border:1px solid #9ca3af">
    <thead>
        <tr style="background:#ffffff;border-bottom:2px solid #111">
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:left;font-size:10px;
                       white-space:nowrap;min-width:36px">Seller Code</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:left;font-size:10px;
                       white-space:nowrap;min-width:140px">Name</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:right;font-size:10px;
                       white-space:nowrap">Qty</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:right;font-size:10px;
                       white-space:nowrap">Amt.</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:right;font-size:10px;
                       white-space:nowrap">Advance</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:right;font-size:10px;
                       white-space:nowrap">Adv. Cr</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:right;font-size:10px;
                       white-space:nowrap">Adv. Bal.</th>
            <th style="padding:5px 7px;border:1px solid #9ca3af;text-align:right;font-size:10px;
                       white-space:nowrap">Net Payable</th>
        </tr>
    </thead>
    <tbody>
        ${sellerRows}
        <!-- Grand Total -->
        <tr style="background:#111;color:#fff;font-weight:bold;border-top:2px solid #111">
            <td colspan="2" style="padding:6px 8px;border:1px solid #374151;font-size:10px">
                Total &nbsp;(${activePrintSellers.length} sellers)
            </td>
            <td style="padding:6px 8px;border:1px solid #374151;text-align:right;font-family:monospace">
                ${grandQty.toFixed(1)}
            </td>
            <td style="padding:6px 8px;border:1px solid #374151;text-align:right;font-family:monospace;color:#6ee7b7">
                ${grandMilk.toFixed(2)}
            </td>
            <td style="padding:6px 8px;border:1px solid #374151;text-align:right;font-family:monospace;color:#c4b5fd">
                ${grandAdv.toFixed(2)}
            </td>
            <td style="padding:6px 8px;border:1px solid #374151;text-align:right;font-family:monospace;color:#fca5a5">
                ${grandInstallment > 0 ? grandInstallment.toFixed(2) : "—"}
            </td>
            <td style="padding:6px 8px;border:1px solid #374151;text-align:right;font-family:monospace;color:#e9d5ff">
                ${grandAdvBalance.toFixed(2)}
            </td>
            <td style="padding:6px 8px;border:1px solid #374151;text-align:right;font-family:monospace;
                       font-size:12px;color:#6ee7b7">
                ${grandFinal.toFixed(2)}
            </td>
        </tr>
    </tbody>
</table>

<!-- Footer -->
<div style="display:flex;justify-content:space-between;margin-top:28px;font-size:9px;color:#9ca3af">
    <span>${t('sellerPayments.computerGenerated')} · ${new Date().toLocaleDateString("en-IN")}</span>
    <span>${t('sellerPayments.authorisedSignatory')}: ___________________________</span>
</div>

<script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

        win.document.write(htmlContent);
        win.document.close();
    };

    // filtered list
    const filtered = sellers.filter(s => {
        const hasEntries = parseFloat(s.milk_amount || 0) > 0;
        if (!hasEntries) return false;
        const matchSearch =
            s.name.toLowerCase().includes(search.toLowerCase()) ||
            (s.seller_code || "").toLowerCase().includes(search.toLowerCase());
        const isPaidFilter = !!(s.is_paid || s.bill_no);
        const matchPaid =
            filterPaid === "all" ? true :
                filterPaid === "paid" ? isPaidFilter : !isPaidFilter;
        return matchSearch && matchPaid;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginatedSellers = filtered.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // totals
    const activeSellers = sellers.filter(s => parseFloat(s.milk_amount || 0) > 0);
    const totalMilk = activeSellers.reduce((a, s) => a + parseFloat(s.milk_amount || 0), 0);
    const totalAdvance = activeSellers.reduce((a, s) => a + parseFloat(s.advance_given || 0), 0);
    const totalDeduction = activeSellers.reduce((a, s) => a + parseFloat(s.deduction_amount || 0), 0);
    const totalProductDeduction = activeSellers.reduce((a, s) => a + parseFloat(s.product_deduction || 0), 0);
    const totalFinal = activeSellers.reduce((a, s) =>
        a + parseFloat(s.final_payable || s.cash_to_pay || 0), 0);
    const paidCount = activeSellers.filter(s => !!(s.is_paid || s.bill_no)).length;

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!cycleConfigLoaded) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('seller_payments', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <style>{`
                * { 
                    -webkit-print-color-adjust: exact !important; 
                    print-color-adjust: exact !important; 
                    color-adjust: exact !important;
                }
                @media print {
                    .no-print { display: none !important; }
                    .print-break { page-break-inside: avoid; }
                    body { 
                        background: white !important; 
                        color: #000000 !important;
                    }
                    /* Ensure all text is black for B&W printing */
                    * {
                        color: #000000 !important;
                        background-color: transparent !important;
                    }
                    /* Keep backgrounds for tables and sections */
                    th, .info-grid, .summary-box, .bs-col-header, .bs-total-row {
                        background-color: #e0e0e0 !important;
                    }
                    .net-row {
                        background-color: #333333 !important;
                        color: #ffffff !important;
                    }
                    .net-row * {
                        color: #ffffff !important;
                    }
                    /* Ensure borders are black */
                    th, td, .summary-box, .bottom-summary, .bs-col {
                        border-color: #000000 !important;
                    }
                }
            `}</style>

            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Wallet size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('sellerPayments.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('sellerPayments.pageSubtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="header-actions">
                        <button onClick={startSellerPaymentsTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                            <BadgeCheck size={13} /> {t('sellerPayments.startTour') || 'Take a Tour'}
                        </button>
                        <button onClick={() => { setBillSearchOpen(true); searchBills(""); }}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-violet-600 text-white hover:bg-violet-700 transition">
                            <FileSearch size={13} /> {t('sellerPayments.searchBills')}
                        </button>
                        {useCustomCycle && (
                            <button onClick={() => setCycleConfigOpen(true)}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
    bg-violet-100 text-violet-700 hover:bg-violet-200 transition border border-violet-200">
                                <Calendar size={13} /> {t('sellerPayments.configureCycle') || 'Configure Cycle'}
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button onClick={printRegister}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-black text-white hover:bg-gray-800 transition">
                                <Printer size={13} /> {t('sellerPayments.printRegister')}
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button onClick={handleBulkDownloadPDFs} disabled={bulkDownloading}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50">
                                {bulkDownloading
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Download size={13} />}
                                {bulkDownloading
                                    ? (t('sellerPayments.bulkDownloading') || 'Downloading…')
                                    : (t('sellerPayments.bulkDownloadAllPDFs') || 'Download All PDFs')}
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button
                                onClick={handleCombinedDownload}
                                disabled={combinedDownloading}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
            bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50">
                                {combinedDownloading
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Download size={13} />}
                                {combinedDownloading
                                    ? (t('sellerPayments.combinedDownloading') || 'Processing…')
                                    : (t('sellerPayments.combinedDownloadAll') || 'Combined PDF')}
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button
                                onClick={() => setExcelConfigOpen(true)}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition border border-emerald-200">
                                <Download size={13} /> Excel Config
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button
                                onClick={async () => {
                                    try {
                                        const response = await api.get(
                                            `/payments/export-excel?from=${customFrom}&to=${customTo}`,
                                            { responseType: 'blob' }
                                        );
                                        const url = window.URL.createObjectURL(new Blob([response.data]));
                                        const link = document.createElement('a');
                                        link.href = url;
                                        link.setAttribute('download', `payments_${customFrom}_to_${customTo}.xlsx`);
                                        document.body.appendChild(link);
                                        link.click();
                                        link.remove();
                                        window.URL.revokeObjectURL(url);
                                    } catch (err) {
                                        const text = await err.response?.data?.text?.();
                                        let msg = 'Export failed';
                                        try { msg = JSON.parse(text)?.message || msg; } catch { }
                                        showFlash('error', msg);
                                    }
                                }}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-emerald-600 text-white hover:bg-emerald-700 transition">
                                <Download size={13} /> Export Excel
                            </button>
                        )}
                    </div>
                </div>

                {/* Date Range */}
                <div className="flex flex-col gap-3 no-print" data-tour="date-range">

                    {/* Mode toggle */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                            <button type="button" onClick={() => handleCycleModeToggle(false)}
                                className={`px-3 py-2 transition ${!useCustomCycle ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {t('sellerPayments.fixedMonthly') || 'Fixed Monthly'}
                            </button>
                            <button type="button" onClick={() => handleCycleModeToggle(true)}
                                className={`px-3 py-2 transition ${useCustomCycle ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {t('sellerPayments.customCycle') || 'Custom Cycle'}
                            </button>
                        </div>

                        {!useCustomCycle && (
                            <div className="flex items-center gap-1.5">
                                {fixedCycles.map((c, idx) => (
                                    <button key={c.label} type="button" onClick={() => selectFixedCycle(idx)}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition
                                            ${activeFixedIdx === idx
                                                ? "bg-violet-600 text-white border-violet-600"
                                                : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Date inputs */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.from')}</span>
                            <input type="date" value={customFrom || ''}
                                disabled={!useCustomCycle}
                                onChange={e => setCustomFrom(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.to')}</span>
                            <input type="date" value={customTo || ''}
                                disabled={!useCustomCycle}
                                onChange={e => setCustomTo(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="flex flex-col gap-0.5 ml-4 pl-4 border-l border-gray-200">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.paymentDate')}</span>
                            <input type="date" value={simulatedToday}
                                onChange={e => setSimulatedToday(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>
                    </div>
                </div>

                {/* Print-only header */}
                <div className="hidden print:block mb-2">
                    <h2 className="text-xl font-bold">{t('sellerPayments.sellerPaymentSummary')}</h2>
                    <p className="text-sm text-gray-500">{fmtDate(cycle.from)} to {fmtDate(cycle.to)}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" data-tour="payment-stats">
                    <StatCard label={t('sellerPayments.totalSellers')} value={activeSellers.length}
                        icon={<Users size={14} />}
                        color="text-blue-600 bg-blue-50 border-blue-100" />
                    <StatCard label={t('sellerPayments.milkAmount')} value={fmt(totalMilk)}
                        icon={<Milk size={14} />}
                        color="text-amber-600 bg-amber-50 border-amber-100" />
                    <StatCard label={t('sellerPayments.advanceTaken')} value={fmt(totalAdvance)}
                        sub={t('sellerPayments.infoOnly')}
                        icon={<Banknote size={14} />}
                        color="text-violet-600 bg-violet-50 border-violet-100" />
                    <StatCard label={t('sellerPayments.productDeduction')} value={fmt(totalProductDeduction)}
                        sub={t('sellerPayments.productSalesCut')}
                        icon={<Banknote size={14} />}
                        color="text-rose-600 bg-rose-50 border-rose-100" />
                </div>

                {/* Progress bar */}
                <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 no-print">
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                            <span>{t('sellerPayments.paymentProgress')}</span>
                            <span className="text-gray-700 font-semibold">{paidCount} / {activeSellers.length} {t('sellerPayments.paid')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                                style={{ width: activeSellers.length ? `${(paidCount / activeSellers.length) * 100}%` : "0%" }} />
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={13} />
                        {activeSellers.length > 0 ? Math.round((paidCount / activeSellers.length) * 100) : 0}% {t('sellerPayments.done')}
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : flash.type === "error"
                                ? "bg-rose-50 border border-rose-200 text-rose-600"
                                : "bg-blue-50 border border-blue-200 text-blue-700"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Search + Filter */}
                <div className="flex items-center gap-2 no-print">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('sellerPayments.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            ["all", t('sellerPayments.all')],
                            ["unpaid", t('sellerPayments.unpaid')],
                            ["paid", t('sellerPayments.paid')]
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterPaid(v)}
                                className={`px-3 py-2 transition
                                    ${filterPaid === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Seller Cards */}
                <div className="flex flex-col gap-3" data-tour="seller-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Wallet size={32} />
                            <p className="text-sm">{t('sellerPayments.noSellersFound')}</p>
                        </div>
                    ) : paginatedSellers.map(seller => {
                        const isOpen = expanded[seller.seller_id];
                        const milkAmt = parseFloat(seller.milk_amount || 0);
                        const advGiven = parseFloat(seller.advance_given || 0);
                        const finalPayable = parseFloat(seller.final_payable || seller.cash_to_pay || 0);
                        const isPaid = !!(seller.is_paid || seller.bill_no);

                        return (
                            <div key={seller.seller_id}
                                className={`bg-white rounded-2xl border transition-all print-break
                                    ${isPaid ? "border-emerald-200" : "border-gray-200"}`}>

                                {/* Row */}
                                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                                    onClick={() => toggleExpand(seller.seller_id)}>

                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isPaid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                                        {seller.name?.charAt(0).toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{seller.name}</p>
                                            {isPaid ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <CheckCircle2 size={9} /> {t('sellerPayments.paid')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                    <Clock size={9} /> {t('sellerPayments.pending')}
                                                </span>
                                            )}
                                            {isPaid && seller.bill_no && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                                                    <Hash size={8} /> {seller.bill_no}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{seller.seller_code}</p>
                                    </div>

                                    {/* Desktop amounts */}
                                    <div className="hidden sm:flex items-center gap-6 text-right mr-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('sellerPayments.milk')}</p>
                                            <p className="text-sm font-semibold text-gray-700">{fmt(milkAmt)}</p>
                                        </div>
                                        {advGiven > 0 && (
                                            <div>
                                                <p className="text-[10px] text-violet-400 uppercase tracking-wider">{t('sellerPayments.advPending')}</p>
                                                <p className="text-sm font-semibold text-violet-500">{fmt(advGiven)}</p>
                                            </div>
                                        )}
                                        {parseFloat(seller.installment_cut || 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] text-rose-400 uppercase tracking-wider">{t('sellerPayments.advInstCut')}</p>
                                                <p className="text-sm font-semibold text-rose-500">− {fmt(seller.installment_cut)}</p>
                                            </div>
                                        )}
                                        {parseFloat(seller.deposit_amount || 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] text-blue-400 uppercase tracking-wider">{t('sellerPayments.depositCut')}</p>
                                                <p className="text-sm font-semibold text-blue-500">− {fmt(seller.deposit_amount)}</p>
                                            </div>
                                        )}
                                        {parseFloat(seller.walkin_deduction || 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] text-orange-400 uppercase tracking-wider">{t('sellerPayments.milkBought')}</p>
                                                <p className="text-sm font-semibold text-orange-500">− {fmt(seller.walkin_deduction)}</p>
                                            </div>
                                        )}
                                        {parseFloat(seller.product_deduction || 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] text-amber-400 uppercase tracking-wider">{t('sellerPayments.products')}</p>
                                                <p className="text-sm font-semibold text-amber-500">− {fmt(seller.product_deduction)}</p>
                                            </div>
                                        )}
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('sellerPayments.cashToPay')}</p>
                                            <p className="text-base font-bold text-gray-900">{fmt(finalPayable)}</p>
                                        </div>
                                    </div>

                                    {isPaid && seller.bill_no && can('seller_payments', 'W') && (
                                        <button
                                            onClick={(e) => handleUndo(e, seller)}
                                            disabled={undoing === seller.seller_id}
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition disabled:opacity-50 shadow-sm shadow-rose-200">
                                            {undoing === seller.seller_id
                                                ? <RefreshCw size={11} className="animate-spin" />
                                                : <RefreshCw size={11} />}
                                            {t('sellerPayments.undo')}
                                        </button>
                                    )}
                                    {isPaid && (
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                await downloadReceiptPDF({
                                                    ...seller,
                                                    bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, cycle.from, cycle.to),
                                                });
                                            }}
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition shadow-sm">
                                            <Printer size={11} />
                                            {t('sellerPayments.pdf')}
                                        </button>
                                    )}
                                    {!isPaid && can('seller_payments', 'W') && (
                                        <button
                                            onClick={(e) => handleMarkPaid(e, seller.seller_id)}
                                            disabled={paying === seller.seller_id || !isTodayPaymentDay(customFrom, customTo)}
                                            title={!isTodayPaymentDay(customFrom, customTo)
                                                ? `Payment only allowed on ${fmtDate(customTo)}`
                                                : undefined}
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl 
      bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition 
      disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-200">
                                            {paying === seller.seller_id
                                                ? <RefreshCw size={11} className="animate-spin" />
                                                : <CheckCircle2 size={11} />}
                                            {isTodayPaymentDay(customFrom, customTo)
                                                ? `${t('sellerPayments.pay')} ₹${finalPayable.toFixed(0)}`
                                                : `Pay on ${fmtDate(customTo)}`}
                                        </button>
                                    )}

                                    <div className="shrink-0 text-gray-300">
                                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Mobile amounts */}
                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs flex-wrap">
                                    <span className="text-gray-400">{t('sellerPayments.milk')}: <strong className="text-gray-700">{fmt(milkAmt)}</strong></span>
                                    {advGiven > 0 && <span className="text-violet-500">{t('sellerPayments.adv')}: {fmt(advGiven)}</span>}
                                    {parseFloat(seller.installment_cut || 0) > 0 && <span className="text-rose-500">{t('sellerPayments.advInstCut')}: −{fmt(seller.installment_cut)}</span>}
                                    {parseFloat(seller.deposit_amount || 0) > 0 && <span className="text-blue-500">{t('sellerPayments.dep')}: −{fmt(seller.deposit_amount)}</span>}
                                    {parseFloat(seller.walkin_deduction || 0) > 0 && <span className="text-rose-500">{t('sellerPayments.bought')}: −{fmt(seller.walkin_deduction)}</span>}
                                    <span className="font-bold text-gray-900">{t('sellerPayments.cash')}: {fmt(finalPayable)}</span>
                                </div>

                                {/* Expanded breakdown */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">

                                        {/* Day-wise entries table */}
                                        {seller.entries?.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('sellerPayments.dailyMilkEntries')}
                                                </p>
                                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                    <div className="grid bg-gray-50 border-b border-gray-100"
                                                        style={{ gridTemplateColumns: "100px 80px 70px 65px 65px 95px" }}>
                                                        {[t('sellerPayments.date'), t('sellerPayments.shift'), t('sellerPayments.qtyL'), t('sellerPayments.fat'), t('sellerPayments.snf'), t('sellerPayments.amount')].map(h => (
                                                            <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                        ))}
                                                    </div>
                                                    {seller.entries.map((e, i) => (
                                                        <div key={i}
                                                            className="grid border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition"
                                                            style={{ gridTemplateColumns: "100px 80px 70px 65px 65px 95px" }}>
                                                            <div className="px-3 py-2 text-xs text-gray-600">{fmtDate(e.entry_date)}</div>
                                                            <div className="px-3 py-2">
                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                                                    ${e.shift === "morning" ? "bg-yellow-50 text-yellow-700" : "bg-indigo-50 text-indigo-600"}`}>
                                                                    {e.shift === "morning" ? "☀" : "🌙"} {e.shift === "morning" ? t('sellerPayments.morning') : t('sellerPayments.evening')}
                                                                </span>
                                                            </div>
                                                            <div className="px-3 py-2 text-xs text-blue-600 font-mono font-semibold">{e.quantity}</div>
                                                            <div className="px-3 py-2 text-xs text-amber-600 font-mono">{e.fat}</div>
                                                            <div className="px-3 py-2 text-xs text-violet-600 font-mono">{e.snf}</div>
                                                            <div className="px-3 py-2 text-xs font-semibold text-gray-800">{fmt(e.total_amount)}</div>
                                                        </div>
                                                    ))}
                                                    <div className="grid bg-gray-50 border-t border-gray-100"
                                                        style={{ gridTemplateColumns: "100px 80px 70px 65px 65px 95px" }}>
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-600 col-span-2">{seller.entries.length} {t('sellerPayments.entries')}</div>
                                                        <div className="px-3 py-2 text-xs font-bold text-blue-700">
                                                            {seller.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)} L
                                                        </div>
                                                        <div className="px-3 py-2" /><div className="px-3 py-2" />
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-900">{fmt(milkAmt)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Walk-in deduction info */}
                                        {parseFloat(seller.walkin_deduction || 0) > 0 && (
                                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-100">
                                                <Banknote size={15} className="text-rose-400 shrink-0" />
                                                <div className="flex-1 text-xs text-rose-700">
                                                    <span className="font-semibold">{t('sellerPayments.milkBoughtBySeller')}: {fmt(seller.walkin_deduction)}</span>
                                                    <p className="text-rose-400 mt-0.5">{t('sellerPayments.deductedFromMilkPayment')}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Final summary */}
                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>{t('sellerPayments.milkPayable')}:
                                                <strong className="text-gray-800 ml-1">{fmt(milkAmt)}</strong>
                                            </p>
                                            {advGiven > 0 && (
                                                <div className="flex flex-col gap-0.5">
                                                    <p>{t('sellerPayments.advancePendingBefore')}:
                                                        <strong className="text-violet-600 ml-1">{fmt(advGiven)}</strong>
                                                    </p>
                                                    {parseFloat(seller.installment_cut || 0) > 0 && (
                                                        <p>{t('sellerPayments.advanceAfterInstallment')}:
                                                            <strong className="text-violet-400 ml-1">{fmt(Math.max(0, advGiven - parseFloat(seller.installment_cut || 0)))}</strong>
                                                            <span className="text-gray-400 ml-1 font-normal text-[10px]">({t('sellerPayments.remaining')})</span>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {parseFloat(seller.installment_cut || 0) > 0 && (
                                                <p>{t('sellerPayments.advInstallmentCut')}:
                                                    <strong className="text-rose-500 ml-1">− {fmt(seller.installment_cut)}</strong>
                                                    <span className="text-gray-400 ml-1 font-normal text-[10px]">({t('sellerPayments.reducesAdvancePending')})</span>
                                                </p>
                                            )}
                                            {parseFloat(seller.deposit_amount || 0) > 0 && (
                                                <p>{t('sellerPayments.depositDeducted')}:
                                                    <strong className="text-blue-600 ml-1">− {fmt(seller.deposit_amount)}</strong>
                                                    <span className="text-gray-400 ml-1 font-normal text-[10px]">
                                                        ({parseFloat(seller.total_milk_quantity || 0).toFixed(2)}L × ₹{seller.deposit_per_litre}/L → {t('sellerPayments.creditedToDeposit')})
                                                    </span>
                                                </p>
                                            )}
                                            {parseFloat(seller.product_deduction || 0) > 0 && (
                                                <p>{t('sellerPayments.productSalesDeducted')}:
                                                    <strong className="text-amber-600 ml-1">− {fmt(seller.product_deduction)}</strong>
                                                </p>
                                            )}
                                            {parseFloat(seller.walkin_deduction || 0) > 0 && (
                                                <p>{t('sellerPayments.milkBoughtWalkin')}:
                                                    <strong className="text-orange-500 ml-1">− {fmt(seller.walkin_deduction)}</strong>
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 text-white mt-2">
                                                <span className="text-xs font-semibold uppercase tracking-wider">{t('sellerPayments.netCashToHand')}</span>
                                                <span className="text-base font-bold">{fmt(finalPayable)}</span>
                                            </div>
                                        </div>

                                        {isPaid && seller.paid_at && (
                                            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                                                <CheckCircle2 size={13} />
                                                {t('sellerPayments.cashPaidOn')} {fmtDate(seller.paid_at)}
                                                {seller.paid_cycle_from && seller.paid_cycle_to && (
                                                    <span className="text-emerald-400 font-normal">
                                                        · {t('sellerPayments.cycle')}: {fmtDate(seller.paid_cycle_from)} → {fmtDate(seller.paid_cycle_to)}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t('sellerPayments.prev')}
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
                                {t('sellerPayments.next')}
                            </button>
                            <span className="text-xs text-gray-400 ml-1">
                                {filtered.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)}`} {t('sellerPayments.of')} {filtered.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('sellerPayments.rowsPerPage')}</span>
                            <input
                                type="number" min={1} max={filtered.length || 1}
                                value={pageSize}
                                onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                    </div>
                )}

                {/* Grand total footer */}
                {filtered.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-6 text-sm">
                            <div>
                                <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('sellerPayments.milkTotal')}</p>
                                <p className="font-bold text-gray-800">{fmt(totalMilk)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-violet-400 uppercase tracking-wider">{t('sellerPayments.totalAdvanceTaken')}</p>
                                <p className="font-bold text-violet-600">{fmt(totalAdvance)}</p>
                            </div>
                            {totalProductDeduction > 0 && (
                                <div>
                                    <p className="text-[10px] text-amber-400 uppercase tracking-wider">{t('sellerPayments.productDeductions')}</p>
                                    <p className="font-bold text-amber-500">− {fmt(totalProductDeduction)}</p>
                                </div>
                            )}
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('sellerPayments.totalCashToHand')}</p>
                            <p className="text-2xl font-bold text-gray-900">{fmt(totalFinal)}</p>
                        </div>
                    </div>
                )}

            </main>

            {/* Bill Search Modal */}
            {billSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-6xl h-[90vh] flex flex-col">

                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                                    <FileSearch size={16} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">{t('sellerPayments.billRegistry')}</h2>
                                    <p className="text-[10px] text-gray-400">{t('sellerPayments.billRegistryDesc')}</p>
                                </div>
                            </div>
                            <button onClick={() => { setBillSearchOpen(false); setBillDetail(null); setBillResults([]); setBillQuery(""); setBillListExpanded(true); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap shrink-0 bg-gray-50/60">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                <input
                                    autoFocus
                                    value={billQuery}
                                    onChange={(e) => {
                                        setBillQuery(e.target.value);
                                        searchBills(e.target.value);
                                        setBillDetail(null);
                                    }}
                                    placeholder={t('sellerPayments.billSearchPlaceholder')}
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                        focus:outline-none focus:ring-2 focus:ring-violet-300 transition placeholder:text-gray-300"
                                />
                                {billLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => { setBillQuery(""); searchBills(""); setBillDetail(null); }}
                                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 bg-white transition">
                                {t('sellerPayments.showAll')}
                            </button>
                            <span className="text-xs text-gray-400 font-medium">
                                {billResults.length > 0 ? `${billResults.length} ${billResults.length !== 1 ? t('sellerPayments.bills') : t('sellerPayments.bill')}` : ""}
                            </span>
                        </div>

                        <div className="flex flex-1 min-h-0 overflow-hidden relative">

                            {/* Left: Bills List */}
                            <div
                                className={`flex flex-col overflow-hidden border-r border-gray-100 transition-all duration-300
                                    ${!billListExpanded && billDetail ? "w-0 overflow-hidden" : billDetail ? "w-2/5" : "w-full"}`}
                                onClick={() => { if (billDetail) setBillDetail(null); }}
                            >
                                <div className="grid px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0"
                                    style={{ gridTemplateColumns: "1fr 1fr 90px 80px 60px 60px" }}>
                                    <div>{t('sellerPayments.billNo')}</div>
                                    <div>{t('sellerPayments.seller')}</div>
                                    <div>{t('sellerPayments.period')}</div>
                                    <div className="text-right">{t('sellerPayments.amount')}</div>
                                    <div></div>
                                    <div></div>
                                </div>

                                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                                    {billLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <div className="w-5 h-5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                        </div>
                                    ) : billResults.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                                            <FileText size={32} />
                                            <p className="text-xs">{t('sellerPayments.noBillsFound')}</p>
                                        </div>
                                    ) : billResults.map(b => {
                                        const isSelected = billDetail?.payment?.bill_no === b.bill_no;
                                        return (
                                            <button
                                                key={b.id}
                                                onClick={(e) => { e.stopPropagation(); loadBillDetail(b.bill_no); }}
                                                className={`w-full text-left px-4 py-3 hover:bg-violet-50/60 transition grid items-center gap-2
                                                    ${isSelected ? "bg-violet-50 border-l-2 border-l-violet-500" : "border-l-2 border-l-transparent"}`}
                                                style={{ gridTemplateColumns: "1fr 1fr 90px 80px 60px 60px" }}>
                                                <div>
                                                    <span className="text-xs font-mono font-bold text-violet-700">{b.bill_no}</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        {t('sellerPayments.paid')}: {new Date(b.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{b.name}</p>
                                                    <p className="text-[10px] font-mono text-gray-400">{b.seller_code}</p>
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    {new Date(b.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                    {" → "}
                                                    {new Date(b.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-bold text-emerald-600">
                                                        ₹{parseFloat(b.cash_paid || 0).toFixed(0)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            try {
                                                                const { data } = await api.get(`/payments/bill/${b.bill_no}`);
                                                                printBillReceipt(data);
                                                            } catch {
                                                                showFlash("error", t('sellerPayments.printLoadError'));
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-semibold hover:bg-gray-700 transition">
                                                        <Printer size={9} /> {t('sellerPayments.pdf')}
                                                    </button>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteBill(b.bill_no); }}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700 transition">
                                                        <Trash2 size={9} /> {t('sellerPayments.del')}
                                                    </button>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: Bill Detail Pane */}
                            {billDetail && (
                                <div className="flex-1 overflow-y-auto flex flex-col relative">
                                    <button
                                        onClick={() => setBillListExpanded(p => !p)}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center
                                            w-5 h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-r-lg shadow-md transition"
                                        title={billListExpanded ? t('sellerPayments.hideList') : t('sellerPayments.showList')}>
                                        {billListExpanded ? <ChevronDown size={11} className="-rotate-90" /> : <ChevronDown size={11} className="rotate-90" />}
                                    </button>

                                    {billDetailLoading ? (
                                        <div className="flex items-center justify-center flex-1">
                                            <div className="w-5 h-5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-violet-50">
                                                <button
                                                    onClick={() => setBillDetail(null)}
                                                    className="absolute right-4 top-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 transition">
                                                    <X size={13} />
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono font-bold text-violet-700">{billDetail.payment.bill_no}</span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">{t('sellerPayments.paid')}</span>
                                                    </div>
                                                    <p className="text-base font-bold text-gray-900 mt-0.5">{billDetail.payment.name}</p>
                                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                                        {t('sellerPayments.code')}: <span className="font-mono">{billDetail.payment.seller_code}</span>
                                                        {" · "}
                                                        {new Date(billDetail.payment.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                        {" → "}
                                                        {new Date(billDetail.payment.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => printBillReceipt(billDetail)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition">
                                                    <Printer size={13} /> {t('sellerPayments.printFullPDF')}
                                                </button>
                                            </div>

                                            <div className="px-6 py-4 flex flex-col gap-5">

                                                {/* Summary Cards */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {[
                                                        { label: t('sellerPayments.milkAmount'), value: `₹${parseFloat(billDetail.payment.milk_amount || 0).toFixed(2)}`, color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
                                                        { label: t('sellerPayments.totalEntries'), value: `${billDetail.entries.length} ${t('sellerPayments.entries')}`, color: "bg-blue-50 border-blue-100 text-blue-700" },
                                                        { label: t('sellerPayments.totalQty'), value: `${billDetail.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L`, color: "bg-amber-50 border-amber-100 text-amber-700" },
                                                        { label: t('sellerPayments.netCashPaid'), value: `₹${parseFloat(billDetail.payment.cash_paid || 0).toFixed(2)}`, color: "bg-gray-900 border-gray-900 text-white" },
                                                    ].map(({ label, value, color }) => (
                                                        <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
                                                            <p className="text-[10px] opacity-70 uppercase tracking-wider">{label}</p>
                                                            <p className="text-sm font-bold mt-0.5">{value}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Milk Entries Table */}
                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                        {t('sellerPayments.milkCollectionEntries')} ({billDetail.entries.length})
                                                    </p>
                                                    <div className="rounded-xl border border-gray-100 overflow-hidden text-xs">
                                                        <div className="grid bg-gray-900 text-white"
                                                            style={{ gridTemplateColumns: "85px 65px 60px 55px 55px 55px 60px 70px" }}>
                                                            {[t('sellerPayments.date'), t('sellerPayments.shift'), t('sellerPayments.type'), t('sellerPayments.qtyL'), t('sellerPayments.fat'), t('sellerPayments.snf'), t('sellerPayments.rate'), t('sellerPayments.amount')].map(h => (
                                                                <div key={h} className="px-3 py-2 text-[10px] font-semibold uppercase">{h}</div>
                                                            ))}
                                                        </div>
                                                        {billDetail.entries.map((e, i) => (
                                                            <div key={i}
                                                                className={`grid border-b border-gray-50 last:border-0 hover:bg-gray-50 transition ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                                                                style={{ gridTemplateColumns: "85px 65px 60px 55px 55px 55px 60px 70px" }}>
                                                                <div className="px-3 py-2 text-gray-600">
                                                                    {new Date(e.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                                                                        ${e.shift === "morning" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-600"}`}>
                                                                        {e.shift === "morning" ? "☀ M" : "🌙 E"}
                                                                    </span>
                                                                </div>
                                                                <div className="px-3 py-2">
                                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                                                                        ${e.milk_type === "cow" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                                                        {e.milk_type}
                                                                    </span>
                                                                </div>
                                                                <div className="px-3 py-2 text-blue-600 font-mono font-semibold">{parseFloat(e.quantity || 0).toFixed(2)}</div>
                                                                <div className="px-3 py-2 text-amber-600 font-mono">{parseFloat(e.fat || 0).toFixed(2)}</div>
                                                                <div className="px-3 py-2 text-violet-600 font-mono">{parseFloat(e.snf || 0).toFixed(2)}</div>
                                                                <div className="px-3 py-2 text-gray-600 font-mono">₹{parseFloat(e.rate_applied || 0).toFixed(2)}</div>
                                                                <div className="px-3 py-2 font-bold text-gray-800">₹{parseFloat(e.total_amount || 0).toFixed(2)}</div>
                                                            </div>
                                                        ))}
                                                        <div className="grid bg-gray-100 border-t-2 border-gray-200 font-bold"
                                                            style={{ gridTemplateColumns: "85px 65px 60px 55px 55px 55px 60px 70px" }}>
                                                            <div className="px-3 py-2 text-xs col-span-3 text-gray-600">{t('sellerPayments.total')}</div>
                                                            <div className="px-3 py-2 text-xs text-blue-700 font-mono">
                                                                {billDetail.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L
                                                            </div>
                                                            <div className="px-3 py-2 col-span-3" />
                                                            <div className="px-3 py-2 text-xs text-gray-900 font-mono">
                                                                ₹{parseFloat(billDetail.payment.milk_amount || 0).toFixed(2)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Deductions Table */}
                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t('sellerPayments.paymentBreakdown')}</p>
                                                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                        {[
                                                            {
                                                                label: t('sellerPayments.milkAmountPayable'),
                                                                value: parseFloat(billDetail.payment.milk_amount || 0),
                                                                type: "credit",
                                                                color: "bg-emerald-50 text-emerald-700",
                                                                always: true,
                                                            },
                                                            {
                                                                label: t('sellerPayments.advancePendingOutstanding'),
                                                                value: parseFloat(billDetail.payment.advance_given || 0),
                                                                type: "info",
                                                                color: "bg-violet-50 text-violet-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.installmentCut'),
                                                                value: parseFloat(billDetail.payment.installment_cut || 0),
                                                                type: "debit",
                                                                color: "bg-rose-50 text-rose-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.depositDeductedPerLitre'),
                                                                value: parseFloat(billDetail.payment.deposit_amount || 0),
                                                                type: "debit",
                                                                color: "bg-blue-50 text-blue-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.productSalesDeduction'),
                                                                value: parseFloat(billDetail.payment.product_deduction || 0),
                                                                type: "debit",
                                                                color: "bg-amber-50 text-amber-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.milkBoughtBySellerWalkinShort'),
                                                                value: parseFloat(billDetail.payment.walkin_deduction || 0),
                                                                type: "debit",
                                                                color: "bg-orange-50 text-orange-700",
                                                                always: false,
                                                            },
                                                        ].filter(row => row.always || row.value > 0).map((row, i) => (
                                                            <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${row.color}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                                                        ${row.type === "credit" ? "bg-emerald-200 text-emerald-800" :
                                                                            row.type === "info" ? "bg-violet-200 text-violet-800" :
                                                                                "bg-rose-200 text-rose-800"}`}>
                                                                        {row.type === "credit" ? "+" : row.type === "info" ? "i" : "−"}
                                                                    </span>
                                                                    <span className="text-xs font-medium">{row.label}</span>
                                                                </div>
                                                                <span className="text-xs font-bold font-mono">
                                                                    {row.type === "debit" ? "− " : row.type === "credit" ? "+ " : ""}
                                                                    ₹{row.value.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        <div className="flex items-center justify-between px-4 py-4 bg-gray-900 text-white">
                                                            <span className="text-sm font-bold uppercase tracking-wider">{t('sellerPayments.netCashToHand')}</span>
                                                            <span className="text-lg font-bold font-mono">
                                                                ₹{parseFloat(billDetail.payment.final_payable || billDetail.payment.cash_paid || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Advances */}
                                                {billDetail.advances?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.advanceTransactions')} ({billDetail.advances.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                            {billDetail.advances.map((a, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                                                                    <div>
                                                                        <p className="text-xs font-medium text-gray-700">{a.remarks || t('sellerPayments.advance')}</p>
                                                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                                                            {new Date(a.transaction_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                                            {" · "}
                                                                            <span className={`font-semibold capitalize ${a.type === "given" ? "text-emerald-600" : "text-rose-600"}`}>{a.type === "given" ? t('sellerPayments.given') : t('sellerPayments.received')}</span>
                                                                        </p>
                                                                    </div>
                                                                    <span className={`text-xs font-bold font-mono ${a.type === "given" ? "text-emerald-600" : "text-rose-600"}`}>
                                                                        {a.type === "given" ? "+" : "−"} ₹{parseFloat(a.amount || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Product Sales */}
                                                {billDetail.productSales?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.productSales')} ({billDetail.productSales.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                            {billDetail.productSales.map((s, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-amber-50/30"}`}>
                                                                    <div>
                                                                        <p className="text-xs font-medium text-gray-700">{s.product_name}</p>
                                                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                                                            {parseFloat(s.quantity || 0).toFixed(2)} {s.unit}
                                                                            {" · "}
                                                                            {new Date(s.sale_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-xs font-bold font-mono text-amber-700">
                                                                        − ₹{parseFloat(s.total_amount || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Walk-in Sales */}
                                                {billDetail.walkinSales?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.walkinSales')} ({billDetail.walkinSales.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                            {billDetail.walkinSales.map((w, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-orange-50/30"}`}>
                                                                    <div>
                                                                        <p className="text-xs font-medium text-gray-700 capitalize">{w.milk_type} {t('sellerPayments.milk')} · {w.shift}</p>
                                                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                                                            {new Date(w.sale_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                            {" · "}{parseFloat(w.quantity || 0).toFixed(2)}L @ ₹{parseFloat(w.mrp || 0).toFixed(2)}/L
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-xs font-bold font-mono text-orange-600">
                                                                        − ₹{parseFloat(w.total_amount || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                                                    <span>{t('sellerPayments.billNoLabel')}: <strong className="text-gray-600">{billDetail.payment.bill_no}</strong> · {t('sellerPayments.computerGenerated')}</span>
                                                    <span>{t('sellerPayments.paidOn')}: {new Date(billDetail.payment.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">{t('sellerPayments.deleteBill')}</h2>
                                    <p className="text-[10px] text-gray-400">{t('sellerPayments.deleteWarning')}</p>
                                </div>
                            </div>
                            <button onClick={cancelDeleteBill}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-3">
                            <p className="text-sm text-gray-600">
                                {t('sellerPayments.deleteConfirmMessage')} <strong className="font-mono text-rose-700">{deletingBill}</strong>?
                            </p>
                            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs text-rose-700 flex flex-col gap-1">
                                <p className="font-semibold">{t('sellerPayments.willBeReversed')}:</p>
                                <ul className="list-disc list-inside text-rose-600 mt-1 space-y-0.5">
                                    <li>{t('sellerPayments.reversalPaymentRecord')}</li>
                                    <li>{t('sellerPayments.reversalAdvanceCut')}</li>
                                    <li>{t('sellerPayments.reversalDepositCredit')}</li>
                                    <li>{t('sellerPayments.reversalSellerStatus')}</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={cancelDeleteBill}
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                {t('sellerPayments.cancel')}
                            </button>
                            <button
                                onClick={confirmDeleteBill}
                                disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50">
                                {deleting
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Trash2 size={12} />}
                                {deleting ? t('sellerPayments.deleting') : t('sellerPayments.yesDeleteBill')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ExcelConfigModal
                open={excelConfigOpen}
                onClose={() => setExcelConfigOpen(false)}
                showFlash={showFlash}
            />
            <CycleConfigModal
                open={cycleConfigOpen}
                onClose={() => setCycleConfigOpen(false)}
                onSave={async (seed, days) => {
                    try {
                        await api.post('/payments/cycle-config', {
                            seed_from: seed,
                            days_per_cycle: days,
                        });
                        setCycleSeedFrom(seed);
                        setCycleDaysPerCycle(days);
                        const active = getActiveCycle(seed, days);
                        if (active) {
                            setCustomFrom(active.from);
                            setCustomTo(active.to);
                        }
                        setCycleConfigOpen(false);
                        showFlash("success", "Cycle configuration saved!");
                    } catch (err) {
                        showFlash("error", "Failed to save cycle config.");
                    }
                }}
                initialSeed={cycleSeedFrom}
                initialDays={cycleDaysPerCycle}
                computeCycles={computeCycles}
            />
        </div>
    );
}