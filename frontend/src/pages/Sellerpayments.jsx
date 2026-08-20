import { useAppConfig } from '../context/AppConfigContext';
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Wallet, ChevronDown, ChevronUp, RefreshCw, Printer,
    BadgeCheck, AlertTriangle, X, Users, Milk,
    CheckCircle2, Clock, Search, Banknote, TrendingUp,
    FileSearch, Hash, FileText, Trash2, Calendar, Download, Package, Percent,
    Home, Settings, Pencil
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
    const m = refDate.getMonth();
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

// ── StatCard - Updated with glass-morphism ───────────────────
function StatCard({ label, value, sub, icon, color }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">{icon}</div>
            <div className="relative z-10">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-1">{value}</p>
                {sub && <p className="text-[10px] text-gray-500 mt-0.5">{sub}</p>}
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
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-violet-50/50 to-white/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <BadgeCheck size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">{t('sellerPayments.configureCycle')}</h2>
                            <p className="text-[10px] text-gray-500">{t('sellerPayments.cycleConfigDesc')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                        <X size={16} />
                    </button>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex items-start gap-3 bg-blue-50/80 backdrop-blur-sm border border-blue-200/60 rounded-xl px-4 py-3 shadow-sm">
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
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('sellerPayments.seedStartDate')}</label>
                            <input type="date" value={localSeed} onChange={e => setLocalSeed(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition shadow-sm" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('sellerPayments.daysPerCycle')}</label>
                            <input type="number" min={1} max={31} value={localDays}
                                onChange={e => setLocalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:bg-white transition shadow-sm" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{t('sellerPayments.upcomingCycles')}</p>
                        <div className="flex flex-col gap-1.5">
                            {previewCycles.map((c, i) => {
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const s = new Date(c.from + 'T00:00:00');
                                const e = new Date(c.to + 'T00:00:00');
                                const isCurrent = today >= s && today <= e;
                                const isPayDay = today.getTime() === e.getTime();
                                const isPast = e < today;
                                return (
                                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs shadow-sm
                                        ${isCurrent ? 'border-violet-200/60 bg-violet-50/80 backdrop-blur-sm' : 'border-gray-200/60 bg-gray-50/80 backdrop-blur-sm'}`}>
                                        <span className="text-[10px] text-gray-400 font-medium min-w-[52px]">Cycle {i + 1}</span>
                                        <span className="flex-1 font-medium text-gray-700">
                                            {s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → {e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-200/80 text-violet-700 font-semibold backdrop-blur-sm">current</span>}
                                        </span>
                                        {isPayDay
                                            ? <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-700 font-semibold backdrop-blur-sm shadow-sm">Payment day — today!</span>
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
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200/60 bg-gray-50/60 rounded-b-2xl">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">{t('sellerPayments.cancel')}</button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200">
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
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-emerald-50/50 to-white/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                            <Download size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Excel Export Config</h2>
                            <p className="text-[10px] text-gray-500">Configure NEFT/RTGS export fields</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                        <X size={16} />
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
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/60 text-xs text-emerald-700 font-medium shadow-sm">
                                    <BadgeCheck size={13} />
                                    Config saved. Click Edit to modify.
                                </div>
                            )}
                            <div className="flex flex-col gap-3">
                                {fields.map(({ key, label, placeholder }) => (
                                    <div key={key} className="flex flex-col gap-1">
                                        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                            {label}
                                        </label>
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={config[key] || ''}
                                                placeholder={placeholder}
                                                onChange={e => setConfig(p => ({ ...p, [key]: e.target.value }))}
                                                className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:bg-white transition shadow-sm"
                                            />
                                        ) : (
                                            <div className="px-4 py-2.5 rounded-xl bg-gray-50/80 backdrop-blur-sm border border-gray-200/60 text-sm font-mono text-gray-700 shadow-sm">
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
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200/60 bg-gray-50/60 rounded-b-2xl">
                    <button onClick={onClose}
                        className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                        Cancel
                    </button>
                    {isLoaded && !isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-gray-700 to-gray-800 text-white shadow-lg shadow-gray-700/30 hover:shadow-xl hover:shadow-gray-700/40 transition-all duration-200">
                            <RefreshCw size={12} /> Edit
                        </button>
                    )}
                    {isLoaded && isEditing && (
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200 disabled:opacity-50">
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
    const navigate = useNavigate();
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
    const [customCutOverrides, setCustomCutOverrides] = useState({});
    const [editingCutSellerId, setEditingCutSellerId] = useState(null);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [filterPaid, setFilterPaid] = useState("all");
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

    useEffect(() => {
        if (!useCustomCycle) return;
        const active = getActiveCycle(cycleSeedFrom, cycleDaysPerCycle);
        if (active) {
            setCustomFrom(active.from);
            setCustomTo(active.to);
        }
    }, [cycleSeedFrom, cycleDaysPerCycle, useCustomCycle]);

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
    }, [customFrom, customTo, t]);
    useEffect(() => {
        if (!cycleConfigLoaded) return;
        fetchPayments();
    }, [fetchPayments, cycleConfigLoaded]);

    useEffect(() => {
        setCustomCutOverrides({});
        setEditingCutSellerId(null);
    }, [customFrom, customTo]);

    const generatePreviewBillNo = (sellerId, fromDate, toDate) => {
        const from = new Date(fromDate);
        const to = new Date(toDate || fromDate);
        const month = String(from.getMonth() + 1).padStart(2, '0');
        const year = String(from.getFullYear()).slice(-2);
        const toDay = String(to.getDate()).padStart(2, '0');
        const sellerSuffix = String(sellerId).padStart(4, '0');
        return `${month}${year}${toDay}${sellerSuffix}`;
    };

    const getEffectiveInstallmentCut = (seller) => {
        const override = customCutOverrides[seller.seller_id];
        const advGiven = parseFloat(seller.advance_given || 0);
        if (override !== undefined && override !== "") {
            const val = parseFloat(override);
            if (!isNaN(val)) return Math.max(0, Math.min(val, advGiven));
        }
        return parseFloat(seller.installment_cut || 0);
    };

    const getEffectiveFinalPayable = (seller) => {
        if (seller.is_paid || seller.bill_no) {
            return Math.max(0, parseFloat(seller.final_payable || seller.cash_to_pay || 0));
        }
        const milkAmt = parseFloat(seller.milk_amount || 0);
        const depositAmt = parseFloat(seller.deposit_amount || 0);
        const cut = getEffectiveInstallmentCut(seller);
        const productDed = parseFloat(seller.product_deduction || 0);
        const walkinDed = parseFloat(seller.walkin_deduction || 0);
        const cattleFeedDed = parseFloat(seller.cattle_feed_deduction || 0);
        const raw = milkAmt - depositAmt - cut - productDed - walkinDed - cattleFeedDed;
        return Math.max(0, parseFloat(raw.toFixed(2)));
    };

    const handleMarkPaid = async (e, sellerId) => {
        e.stopPropagation();
        if (paying) return;
        setPaying(sellerId);

        const seller = sellers.find(s => s.seller_id === sellerId);
        if (!seller) return;

        const depositAmount = parseFloat(seller.total_milk_quantity || 0) * parseFloat(seller.deposit_per_litre || 0);
        const installmentCut = getEffectiveInstallmentCut(seller);

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
            setCustomCutOverrides(prev => {
                if (!(sellerId in prev)) return prev;
                const next = { ...prev };
                delete next[sellerId];
                return next;
            });
            await fetchPayments();
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('sellerPayments.paidError'));
        } finally {
            setPaying(null);
        }
    };

    const handleUndo = async (e, seller) => {
        e.stopPropagation();
        if (undoing || !seller?.bill_no) return;
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

    // ─────────────────────────────────────────────────────────────
    // INDUSTRY-GRADE PDF DESIGN SYSTEM
    // ─────────────────────────────────────────────────────────────

    const PDF_PAGE = {
        widthPx: 1123,          // A4 landscape at ~96 DPI
        heightPx: 794,
        widthMm: 297,
        heightMm: 210,
        marginMm: 10,
        contentWidthMm: 277,
        contentHeightMm: 190,
    };

    const PDF_COLORS = {
        ink: "#111827",
        text: "#1f2937",
        muted: "#6b7280",
        subtle: "#9ca3af",
        border: "#d1d5db",
        borderDark: "#9ca3af",
        surface: "#f9fafb",
        surfaceAlt: "#f3f4f6",

        primary: "#1f4e78",
        primaryDark: "#163a5c",
        primaryLight: "#eaf2f8",

        success: "#166534",
        successBg: "#ecfdf5",

        warning: "#92400e",
        warningBg: "#fffbeb",

        danger: "#991b1b",
        dangerBg: "#fef2f2",

        info: "#1d4ed8",
        infoBg: "#eff6ff",

        violet: "#6d28d9",
        violetBg: "#f5f3ff",

        white: "#ffffff",
    };

    const pdfEscape = (value) => {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };

    const pdfMoney = (value) =>
        `₹${parseFloat(value || 0).toFixed(2)}`;

    const pdfNumber = (value, decimals = 2) =>
        parseFloat(value || 0).toFixed(decimals);

    const pdfDate = (value) =>
        value
            ? new Date(value).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
            })
            : "—";

    const pdfDateShort = (value) =>
        value
            ? new Date(value).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "2-digit",
            })
            : "—";

    const pdfWaitForLayout = (ms = 300) =>
        new Promise(resolve => setTimeout(resolve, ms));

    // ─────────────────────────────────────────────────────────────
    // Render HTML into a high-resolution canvas
    // ─────────────────────────────────────────────────────────────

    const renderPdfHtml = async (htmlContent) => {
        let iframe = null;

        try {
            iframe = document.createElement("iframe");

            Object.assign(iframe.style, {
                position: "fixed",
                left: "-100000px",
                top: "0",
                width: `${PDF_PAGE.widthPx}px`,
                height: `${PDF_PAGE.heightPx}px`,
                border: "0",
                opacity: "0",
                pointerEvents: "none",
                zIndex: "-1",
            });

            document.body.appendChild(iframe);

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error("PDF iframe load timeout")),
                    10000
                );

                iframe.onload = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                iframe.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error("Unable to load PDF HTML"));
                };

                iframe.srcdoc = htmlContent;
            });

            await pdfWaitForLayout(400);

            const iframeDoc = iframe.contentDocument;

            if (!iframeDoc?.body) {
                throw new Error("PDF document body is unavailable");
            }

            // Make sure fonts and layout have settled.
            if (iframeDoc.fonts?.ready) {
                await iframeDoc.fonts.ready;
            }

            const body = iframeDoc.body;
            const documentElement = iframeDoc.documentElement;

            const width = Math.max(
                body.scrollWidth,
                body.offsetWidth,
                documentElement.scrollWidth,
                PDF_PAGE.widthPx
            );

            const height = Math.max(
                body.scrollHeight,
                body.offsetHeight,
                documentElement.scrollHeight
            );

            iframe.style.width = `${width}px`;
            iframe.style.height = `${height}px`;

            await pdfWaitForLayout(100);

            const canvas = await html2canvas(body, {
                scale: 3,
                useCORS: true,
                allowTaint: false,
                logging: false,

                backgroundColor: PDF_COLORS.white,

                width,
                height,

                windowWidth: width,
                windowHeight: height,

                imageTimeout: 15000,

                onclone: (clonedDocument) => {
                    clonedDocument.documentElement.style.background =
                        PDF_COLORS.white;

                    clonedDocument.body.style.background =
                        PDF_COLORS.white;
                },
            });

            return canvas;

        } finally {
            if (iframe?.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        }
    };


    // ─────────────────────────────────────────────────────────────
    // Add a tall canvas to A4 landscape PDF pages without stretching
    // ─────────────────────────────────────────────────────────────

    const addCanvasToPdfPages = (pdf, canvas, options = {}) => {
        const {
            marginMm = PDF_PAGE.marginMm,
            addPageBefore = false,
        } = options;

        const contentWidthMm =
            PDF_PAGE.widthMm - marginMm * 2;

        const contentHeightMm =
            PDF_PAGE.heightMm - marginMm * 2;

        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        const pixelsPerMm = canvasWidth / contentWidthMm;

        const pageContentHeightPx =
            Math.floor(contentHeightMm * pixelsPerMm);

        let sourceY = 0;
        let pageIndex = 0;

        while (sourceY < canvasHeight) {
            if (pageIndex > 0 || addPageBefore) {
                pdf.addPage("a4", "landscape");
            }

            const remainingHeight = canvasHeight - sourceY;

            const sliceHeightPx = Math.min(
                pageContentHeightPx,
                remainingHeight
            );

            const sliceCanvas = document.createElement("canvas");

            sliceCanvas.width = canvasWidth;
            sliceCanvas.height = sliceHeightPx;

            const ctx = sliceCanvas.getContext("2d");

            if (!ctx) {
                throw new Error("Unable to create PDF canvas context");
            }

            ctx.fillStyle = PDF_COLORS.white;
            ctx.fillRect(
                0,
                0,
                sliceCanvas.width,
                sliceCanvas.height
            );

            ctx.drawImage(
                canvas,
                0,
                sourceY,
                canvasWidth,
                sliceHeightPx,
                0,
                0,
                canvasWidth,
                sliceHeightPx
            );

            const sliceHeightMm =
                sliceHeightPx / pixelsPerMm;

            const imageData =
                sliceCanvas.toDataURL("image/jpeg", 0.96);

            pdf.addImage(
                imageData,
                "JPEG",
                marginMm,
                marginMm,
                contentWidthMm,
                sliceHeightMm,
                undefined,
                "FAST"
            );

            sourceY += sliceHeightPx;
            pageIndex++;
        }
    };


    // ─────────────────────────────────────────────────────────────
    // Final PDF generator
    // ─────────────────────────────────────────────────────────────

    const generateReceiptPDF = async (htmlContent, fileName) => {
        try {
            const canvas = await renderPdfHtml(htmlContent);

            const pdf = new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4",
                compress: true,
            });

            addCanvasToPdfPages(pdf, canvas);

            pdf.save(fileName);

            return true;

        } catch (error) {
            console.error(
                "[SellerPayments] PDF generation error:",
                error
            );

            return false;
        }
    };

    // Replace the entire buildReceiptHtml function with this:

    const buildReceiptHtml = async (seller, overrideCycle) => {
        const activeCycle = overrideCycle || cycle;

        let billData = null;

        if (seller.bill_no) {
            try {
                const { data } = await api.get(
                    `/payments/bill/${seller.bill_no}`
                );

                billData = data;
            } catch (error) {
                console.error(
                    "Failed to load bill:",
                    seller.bill_no,
                    error
                );

                return null;
            }
        }

        const entries =
            billData?.entries ||
            seller.entries ||
            [];

        const productSales =
            billData?.productSales ||
            [];

        const walkinSales =
            billData?.walkinSales ||
            [];

        const cattleFeedSales =
            billData?.cattleFeedSales ||
            [];


        // ─────────────────────────────────────────────
        // Normalized seller object
        // ─────────────────────────────────────────────

        const sellerObj = {
            ...seller,

            entries,

            product_deduction:
                billData?.payment?.product_deduction ??
                seller.product_deduction,

            walkin_deduction:
                billData?.payment?.walkin_deduction ??
                seller.walkin_deduction,

            cattle_feed_deduction:
                billData?.payment?.cattle_feed_deduction ??
                seller.cattle_feed_deduction,

            installment_cut:
                billData?.payment?.installment_cut ??
                seller.installment_cut,

            deposit_amount: seller.bill_no
                ? (
                    billData?.depositAddedThisCycle ??
                    billData?.payment?.deposit_amount ??
                    seller.deposit_amount
                )
                : (
                    billData?.payment?.deposit_amount ??
                    seller.deposit_amount
                ),

            deposit_per_litre:
                billData?.payment?.deposit_per_litre ??
                seller.deposit_per_litre,

            commission_amount:
                billData?.payment?.commission_amount ??
                seller.commission_amount,

            total_milk_quantity:
                entries.reduce(
                    (sum, entry) =>
                        sum + parseFloat(entry.quantity || 0),
                    0
                ),

            advance_given:
                billData?.depositSnapshot?.[0] != null
                    ? (
                        billData?.payment?.advance_given ??
                        seller.advance_given
                    )
                    : seller.advance_given,

            opening_deposit: seller.bill_no
                ? (
                    billData?.depositSnapshot?.[0]
                        ?.deposit_balance_before ?? 0
                )
                : (
                    seller.deposit_balance ?? 0
                ),

            final_payable:
                billData?.payment?.final_payable ??
                billData?.payment?.cash_paid ??
                seller.final_payable,

            cash_to_pay:
                billData?.payment?.cash_paid ??
                seller.cash_to_pay,

            is_paid: true,

            paid_at:
                billData?.payment?.paid_at ??
                seller.paid_at,

            bill_no:
                seller.bill_no ||
                generatePreviewBillNo(
                    seller.seller_id,
                    activeCycle.from,
                    activeCycle.to
                ),
        };


        // ─────────────────────────────────────────────
        // Financial calculations
        // ─────────────────────────────────────────────

        const milkAmt =
            parseFloat(sellerObj.milk_amount || 0);

        const depositAmt =
            parseFloat(sellerObj.deposit_amount || 0);

        const installmentCut =
            parseFloat(sellerObj.installment_cut || 0);

        const productDed =
            parseFloat(sellerObj.product_deduction || 0);

        const walkinDed =
            parseFloat(sellerObj.walkin_deduction || 0);

        const cattleFeedDed =
            parseFloat(
                sellerObj.cattle_feed_deduction || 0
            );

        const advGiven =
            parseFloat(sellerObj.advance_given || 0);

        const openingDeposit =
            parseFloat(sellerObj.opening_deposit || 0);

        const finalPayable = Math.max(
            0,
            parseFloat(
                sellerObj.final_payable ||
                sellerObj.cash_to_pay ||
                0
            )
        );

        const closingAdvance = Math.max(
            0,
            advGiven - installmentCut
        );

        const closingDeposit =
            openingDeposit + depositAmt;


        // ─────────────────────────────────────────────
        // Milk calculations
        // ─────────────────────────────────────────────

        const totalQty = entries.reduce(
            (sum, e) =>
                sum + parseFloat(e.quantity || 0),
            0
        );

        const cowQty = entries
            .filter(e => e.milk_type === "cow")
            .reduce(
                (sum, e) =>
                    sum + parseFloat(e.quantity || 0),
                0
            );

        const buffaloQty = entries
            .filter(e => e.milk_type === "buffalo")
            .reduce(
                (sum, e) =>
                    sum + parseFloat(e.quantity || 0),
                0
            );

        const avgFat = entries.length
            ? (
                entries.reduce(
                    (sum, e) =>
                        sum + parseFloat(e.fat || 0),
                    0
                ) / entries.length
            ).toFixed(2)
            : "0.00";

        const avgSnf = entries.length
            ? (
                entries.reduce(
                    (sum, e) =>
                        sum + parseFloat(e.snf || 0),
                    0
                ) / entries.length
            ).toFixed(2)
            : "0.00";


        const morningEntries =
            entries.filter(e => e.shift === "morning");

        const eveningEntries =
            entries.filter(e => e.shift === "evening");

        const allDates = [
            ...new Set(
                entries
                    .map(e => e.entry_date?.split("T")[0])
                    .filter(Boolean)
            ),
        ].sort();


        const mQty = morningEntries.reduce(
            (sum, e) =>
                sum + parseFloat(e.quantity || 0),
            0
        );

        const eQty = eveningEntries.reduce(
            (sum, e) =>
                sum + parseFloat(e.quantity || 0),
            0
        );

        const mAmt = morningEntries.reduce(
            (sum, e) =>
                sum + parseFloat(e.total_amount || 0),
            0
        );

        const eAmt = eveningEntries.reduce(
            (sum, e) =>
                sum + parseFloat(e.total_amount || 0),
            0
        );

        const mFat = morningEntries.length
            ? morningEntries.reduce(
                (sum, e) =>
                    sum + parseFloat(e.fat || 0),
                0
            ) / morningEntries.length
            : 0;

        const eFat = eveningEntries.length
            ? eveningEntries.reduce(
                (sum, e) =>
                    sum + parseFloat(e.fat || 0),
                0
            ) / eveningEntries.length
            : 0;

        const mSnf = morningEntries.length
            ? morningEntries.reduce(
                (sum, e) =>
                    sum + parseFloat(e.snf || 0),
                0
            ) / morningEntries.length
            : 0;

        const eSnf = eveningEntries.length
            ? eveningEntries.reduce(
                (sum, e) =>
                    sum + parseFloat(e.snf || 0),
                0
            ) / eveningEntries.length
            : 0;


        // ─────────────────────────────────────────────
        // Row helpers
        // ─────────────────────────────────────────────

        const milkCell = (entry) => {
            if (!entry) {
                return `
                <td class="num empty">—</td>
                <td class="num empty">—</td>
                <td class="num empty">—</td>
                <td class="money empty">—</td>
                <td class="money empty">—</td>
                <td class="money empty">—</td>
                <td class="num empty">—</td>
            `;
            }

            const qty =
                parseFloat(entry.quantity || 0);

            const fat =
                parseFloat(entry.fat || 0);

            const snf =
                parseFloat(entry.snf || 0);

            const baseRate =
                parseFloat(
                    entry.base_rate ||
                    entry.rate_applied ||
                    0
                );

            const finalRate =
                parseFloat(entry.rate_applied || 0);

            const amount =
                parseFloat(entry.total_amount || 0);

            const ratePerLtr =
                qty > 0
                    ? (amount / qty).toFixed(2)
                    : "—";

            return `
            <td class="num">${qty.toFixed(2)}</td>
            <td class="num">${fat.toFixed(1)}</td>
            <td class="num">${snf.toFixed(1)}</td>
            <td class="money">${baseRate.toFixed(2)}</td>
            <td class="money rate-final">${finalRate.toFixed(2)}</td>
            <td class="money strong">${amount.toFixed(2)}</td>
            <td class="num">${ratePerLtr}</td>
        `;
        };


        const buildRow = (date) => {
            const morning =
                morningEntries.find(
                    e => e.entry_date?.startsWith(date)
                );

            const evening =
                eveningEntries.find(
                    e => e.entry_date?.startsWith(date)
                );

            const dayAmount =
                parseFloat(
                    morning?.total_amount || 0
                ) +
                parseFloat(
                    evening?.total_amount || 0
                );

            return `
            <tr>
                <td class="date-cell">
                    ${pdfDateShort(date)}
                </td>

                ${milkCell(morning)}
                ${milkCell(evening)}

                <td class="money day-total">
                    ${dayAmount > 0
                    ? dayAmount.toFixed(2)
                    : "—"
                }
                </td>
            </tr>
        `;
        };


        // ─────────────────────────────────────────────
        // Product deductions
        // ─────────────────────────────────────────────

        const productSalesTable =
            productSales.length > 0
                ? `
                <section class="section">
                    <div class="section-heading">
                        ${pdfEscape(
                    t(
                        "sellerPayments.productSalesDeductions"
                    )
                )}
                    </div>

                    <table class="small-table">
                        <thead>
                            <tr>
                                <th class="text-left">
                                    ${pdfEscape(
                    t("sellerPayments.product")
                )}
                                </th>
                                <th>
                                    ${pdfEscape(
                    t("sellerPayments.qty")
                )}
                                </th>
                                <th>
                                    ${pdfEscape(
                    t("sellerPayments.rate")
                )}
                                </th>
                                <th class="text-right">
                                    ${pdfEscape(
                    t("sellerPayments.amount")
                )}
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            ${productSales.map((p, index) => `
                                <tr class="${index % 2 ? "alt-row" : ""}">
                                    <td class="text-left">
                                        ${pdfEscape(
                    p.product_name ||
                    t(
                        "sellerPayments.unknown"
                    )
                )}
                                    </td>

                                    <td>
                                        ${pdfNumber(
                    p.quantity
                )} ${pdfEscape(
                    p.unit || ""
                )}
                                    </td>

                                    <td>
                                        ${pdfMoney(p.rate)}
                                    </td>

                                    <td class="money strong">
                                        ${pdfMoney(
                    p.total_amount
                )}
                                    </td>
                                </tr>
                            `).join("")}

                            <tr class="total-row">
                                <td
                                    colspan="3"
                                    class="text-left"
                                >
                                    ${pdfEscape(
                    t("sellerPayments.total")
                )}
                                </td>

                                <td class="money">
                                    ${pdfMoney(productDed)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            `
                : "";


        // ─────────────────────────────────────────────
        // Cattle feed deductions
        // ─────────────────────────────────────────────

        const cattleFeedTable =
            cattleFeedSales.length > 0
                ? `
                <section class="section">
                    <div class="section-heading">
                        ${pdfEscape(
                    t(
                        "sellerPayments.cattleFeedDeductions"
                    )
                )}
                    </div>

                    <table class="small-table">
                        <thead>
                            <tr>
                                <th class="text-left">
                                    ${pdfEscape(
                    t("sellerPayments.feed")
                )}
                                </th>
                                <th>
                                    ${pdfEscape(
                    t("sellerPayments.qty")
                )}
                                </th>
                                <th>
                                    ${pdfEscape(
                    t("sellerPayments.rate")
                )}
                                </th>
                                <th class="text-right">
                                    ${pdfEscape(
                    t("sellerPayments.amount")
                )}
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            ${cattleFeedSales.map((feed, index) => `
                                <tr class="${index % 2 ? "alt-row" : ""}">
                                    <td class="text-left">
                                        ${pdfEscape(
                    feed.feed_name ||
                    t(
                        "sellerPayments.unknown"
                    )
                )}
                                    </td>

                                    <td>
                                        ${pdfNumber(
                    feed.quantity
                )}
                                    </td>

                                    <td>
                                        ${pdfMoney(feed.rate)}
                                    </td>

                                    <td class="money strong">
                                        ${pdfMoney(
                    feed.total_amount
                )}
                                    </td>
                                </tr>
                            `).join("")}

                            <tr class="total-row">
                                <td
                                    colspan="3"
                                    class="text-left"
                                >
                                    ${pdfEscape(
                    t("sellerPayments.total")
                )}
                                </td>

                                <td class="money">
                                    ${pdfMoney(cattleFeedDed)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </section>
            `
                : "";


        const walkinBanner =
            walkinDed > 0
                ? `
                <div class="notice notice-warning">
                    <span>
                        ${pdfEscape(
                    t(
                        "sellerPayments.milkBoughtBySeller"
                    )
                )}
                    </span>

                    <strong>
                        ${pdfMoney(walkinDed)}
                    </strong>
                </div>
            `
                : "";


        const commissionAmt =
            parseFloat(
                sellerObj.commission_amount || 0
            );

        const commissionBanner =
            sellerObj.seller_type === "Gavali" &&
                commissionAmt > 0
                ? `
                <div class="notice notice-violet">
                    <span>
                        ${pdfEscape(
                    t(
                        "sellerPayments.gavaliCommissionIncluded"
                    ) ||
                    "Gavali Commission (included in milk rate)"
                )}
                    </span>

                    <strong>
                        + ${pdfMoney(commissionAmt)}
                    </strong>
                </div>
            `
                : "";


        // ─────────────────────────────────────────────
        // Final professional HTML
        // ─────────────────────────────────────────────

        return `<!DOCTYPE html>
<html lang="en">

<head>
<meta charset="UTF-8">

<title>
    ${pdfEscape(
            t("sellerPayments.paymentReceipt")
        )} -
    ${pdfEscape(sellerObj.name)}
</title>

<style>

@page {
    size: A4 landscape;
    margin: 10mm;
}

*,
*::before,
*::after {
    box-sizing: border-box;
}

html,
body {
    margin: 0;
    padding: 0;
    background: #ffffff;
}

body {
    width: 100%;
    font-family:
        Arial,
        "Helvetica Neue",
        "Noto Sans",
        sans-serif;

    font-size: 9px;
    line-height: 1.35;
    color: ${PDF_COLORS.text};

    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;

    text-rendering: geometricPrecision;
}

.receipt {
    width: 100%;
    max-width: 1123px;
    margin: 0 auto;
    background: #ffffff;
}


/* ─────────────────────────────────────────────
   HEADER
   ───────────────────────────────────────────── */

.header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    padding-bottom: 8px;
    margin-bottom: 9px;

    border-bottom: 2px solid ${PDF_COLORS.primaryDark};
}

.brand {
    min-width: 0;
}

.brand-name {
    margin: 0;

    font-size: 20px;
    line-height: 1.1;
    font-weight: 700;

    letter-spacing: -0.2px;
    color: ${PDF_COLORS.primaryDark};
}

.document-title {
    margin-top: 3px;

    font-size: 9px;
    line-height: 1.2;
    font-weight: 600;

    text-transform: uppercase;
    letter-spacing: 0.8px;

    color: ${PDF_COLORS.muted};
}

.header-meta {
    text-align: right;

    font-size: 8.5px;
    line-height: 1.55;

    color: ${PDF_COLORS.muted};
}

.header-meta .cycle {
    font-size: 10px;
    font-weight: 700;
    color: ${PDF_COLORS.ink};
}

.header-meta .bill {
    font-family:
        "Courier New",
        monospace;

    font-weight: 700;
    color: ${PDF_COLORS.primary};
}


/* ─────────────────────────────────────────────
   SELLER INFORMATION
   ───────────────────────────────────────────── */

.info-grid {
    display: grid;

    grid-template-columns:
        1.8fr
        1fr
        .8fr
        .8fr
        .9fr
        1fr
        1fr
        1fr;

    border: 1px solid ${PDF_COLORS.border};
    border-radius: 4px;

    background: ${PDF_COLORS.surface};

    margin-bottom: 9px;

    overflow: hidden;
}

.info-item {
    min-width: 0;

    padding: 6px 8px;

    border-right: 1px solid ${PDF_COLORS.border};
}

.info-item:last-child {
    border-right: 0;
}

.info-label {
    margin-bottom: 2px;

    font-size: 6.8px;
    line-height: 1.2;

    font-weight: 700;

    text-transform: uppercase;
    letter-spacing: .55px;

    color: ${PDF_COLORS.muted};
}

.info-value {
    min-height: 12px;

    font-size: 9px;
    line-height: 1.3;

    font-weight: 600;

    color: ${PDF_COLORS.ink};

    overflow-wrap: anywhere;
}

.mono {
    font-family:
        "Courier New",
        monospace;
}


/* ─────────────────────────────────────────────
   KPI SUMMARY
   ───────────────────────────────────────────── */

.kpi-grid {
    display: grid;

    grid-template-columns:
        repeat(4, 1fr);

    gap: 6px;

    margin-bottom: 9px;
}

.kpi {
    padding: 7px 9px;

    border: 1px solid ${PDF_COLORS.border};
    border-radius: 4px;

    background: #ffffff;
}

.kpi-label {
    font-size: 6.8px;
    line-height: 1.2;

    font-weight: 700;

    text-transform: uppercase;
    letter-spacing: .5px;

    color: ${PDF_COLORS.muted};
}

.kpi-value {
    margin-top: 2px;

    font-size: 13px;
    line-height: 1.15;

    font-weight: 700;

    color: ${PDF_COLORS.ink};
}

.kpi-sub {
    margin-top: 2px;

    font-size: 6.8px;
    line-height: 1.2;

    color: ${PDF_COLORS.muted};
}


/* ─────────────────────────────────────────────
   SECTIONS
   ───────────────────────────────────────────── */

.section {
    margin-top: 8px;
    margin-bottom: 8px;
}

.section-heading {
    display: flex;
    align-items: center;

    min-height: 17px;

    margin-bottom: 4px;
    padding-bottom: 3px;

    border-bottom: 1px solid ${PDF_COLORS.borderDark};

    font-size: 8px;
    line-height: 1.2;

    font-weight: 700;

    text-transform: uppercase;
    letter-spacing: .65px;

    color: ${PDF_COLORS.primaryDark};
}


/* ─────────────────────────────────────────────
   TABLES
   ───────────────────────────────────────────── */

table {
    width: 100%;

    border-collapse: collapse;
    border-spacing: 0;

    table-layout: fixed;

    font-size: 7.4px;
}

th,
td {
    border: 1px solid ${PDF_COLORS.border};

    padding: 4px 4px;

    vertical-align: middle;

    line-height: 1.2;

    text-align: center;

    white-space: nowrap;
}

th {
    background: ${PDF_COLORS.surfaceAlt};

    color: ${PDF_COLORS.ink};

    font-size: 10px;
    font-weight: 700;

    text-transform: uppercase;
    letter-spacing: .25px;
}

td {
    color: ${PDF_COLORS.text};
    font-weight: 500;
        font-size: 10;

}

.text-left {
    text-align: left !important;
}

.text-right {
    text-align: right !important;
}

.num {
    text-align: center;
}

.money {
    text-align: right;

    font-family:
        "Courier New",
        monospace;

    font-variant-numeric: tabular-nums;
}

.strong {
    font-weight: 700;
    color: ${PDF_COLORS.ink};
}

.rate-final {
    font-weight: 600;
    color: ${PDF_COLORS.success};
}

.empty {
    color: ${PDF_COLORS.subtle};
}

.date-cell {
    background: ${PDF_COLORS.surface};

    font-weight: 700;

    color: ${PDF_COLORS.ink};
}

.day-total {
    background: ${PDF_COLORS.primaryLight};

    font-weight: 700;

    color: ${PDF_COLORS.primaryDark};
}

.alt-row {
    background: #fafafa;
}

.total-row td {
    background: ${PDF_COLORS.surfaceAlt};

    border-top: 2px solid ${PDF_COLORS.primaryDark};

    font-weight: 700;
}

.milk-table th {
    color: #ffffff;
}

.morning-group {
    background: ${PDF_COLORS.primary} !important;
}

.evening-group {
    background: #374151 !important;
}

.day-total-head {
    background: ${PDF_COLORS.primaryDark} !important;
    color: #ffffff !important;
}


/* ─────────────────────────────────────────────
   ACCOUNT SUMMARY
   ───────────────────────────────────────────── */

.account-grid {
    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    border: 1px solid ${PDF_COLORS.border};

    border-radius: 4px;

    overflow: hidden;

    margin-bottom: 8px;
}

.account {
    min-width: 0;

    border-right: 1px solid ${PDF_COLORS.border};
}

.account:last-child {
    border-right: 0;
}

.account-header {
    padding: 5px 8px;

    background: ${PDF_COLORS.primaryDark};

    color: #ffffff;

    text-align: center;

    font-size: 7px;
    font-weight: 700;

    text-transform: uppercase;
    letter-spacing: .55px;
}

.account-row {
    display: flex;

    justify-content: space-between;
    align-items: center;

    gap: 8px;

    min-height: 21px;

    padding: 4px 8px;

    border-bottom: 1px solid #e5e7eb;

    font-size: 7.5px;
}

.account-row:last-child {
    border-bottom: 0;
}

.account-label {
    color: ${PDF_COLORS.muted};
}

.account-value {
    flex-shrink: 0;

    font-family:
        "Courier New",
        monospace;

    font-weight: 700;

    color: ${PDF_COLORS.ink};
}

.account-total {
    display: flex;

    justify-content: space-between;

    padding: 5px 8px;

    border-top: 2px solid ${PDF_COLORS.primaryDark};

    background: ${PDF_COLORS.surfaceAlt};

    font-size: 8px;
    font-weight: 700;
}


/* ─────────────────────────────────────────────
   NOTICES
   ───────────────────────────────────────────── */

.notice {
    display: flex;

    justify-content: space-between;
    align-items: center;

    gap: 12px;

    margin: 5px 0;

    padding: 6px 9px;

    border: 1px solid;

    border-radius: 4px;

    font-size: 7.8px;
}

.notice strong {
    font-family:
        "Courier New",
        monospace;

    font-size: 8.5px;
}

.notice-warning {
    background: ${PDF_COLORS.warningBg};
    border-color: #fcd34d;
    color: ${PDF_COLORS.warning};
}

.notice-violet {
    background: ${PDF_COLORS.violetBg};
    border-color: #c4b5fd;
    color: ${PDF_COLORS.violet};
}


/* ─────────────────────────────────────────────
   DETAILED BREAKDOWN
   ───────────────────────────────────────────── */

.breakdown {
    border: 1px solid ${PDF_COLORS.border};

    border-radius: 4px;

    overflow: hidden;

    margin-bottom: 8px;
}

.breakdown-row {
    display: flex;

    justify-content: space-between;
    align-items: center;

    gap: 12px;

    min-height: 22px;

    padding: 4px 9px;

    border-bottom: 1px solid ${PDF_COLORS.border};

    font-size: 7.6px;
}

.breakdown-row:last-child {
    border-bottom: 0;
}

.breakdown-label {
    color: ${PDF_COLORS.text};
}

.breakdown-detail {
    margin-left: 4px;

    color: ${PDF_COLORS.muted};

    font-size: 6.7px;
}

.breakdown-value {
    flex-shrink: 0;

    font-family:
        "Courier New",
        monospace;

    font-weight: 700;
}

.breakdown-positive {
    background: ${PDF_COLORS.successBg};
}

.breakdown-negative {
    background: ${PDF_COLORS.dangerBg};
}

.breakdown-info {
    background: ${PDF_COLORS.infoBg};
}

.breakdown-warning {
    background: ${PDF_COLORS.warningBg};
}

.net-payable {
    display: flex;

    justify-content: space-between;
    align-items: center;

    padding: 8px 10px;

    background: ${PDF_COLORS.primaryDark};

    color: #ffffff;

    border-top: 2px solid #0f2940;
}

.net-payable .label {
    font-size: 8px;
    font-weight: 700;

    text-transform: uppercase;
    letter-spacing: .65px;
}

.net-payable .amount {
    font-family:
        "Courier New",
        monospace;

    font-size: 13px;
    font-weight: 700;

    color: #ffffff;
}


/* ─────────────────────────────────────────────
   FOOTER
   ───────────────────────────────────────────── */

.footer {
    display: flex;

    justify-content: space-between;

    gap: 20px;

    margin-top: 8px;
    padding-top: 6px;

    border-top: 1px solid ${PDF_COLORS.border};

    color: ${PDF_COLORS.muted};

    font-size: 6.7px;
}

.footer-right {
    text-align: right;
}


/* ─────────────────────────────────────────────
   PRINT / PAGE BREAKS
   ───────────────────────────────────────────── */

.section,
.kpi,
.account,
.notice,
.breakdown {
    break-inside: avoid;
    page-break-inside: avoid;
}

tr {
    break-inside: avoid;
    page-break-inside: avoid;
}

thead {
    display: table-header-group;
}

@media print {

    body {
        width: 100%;
    }

    .receipt {
        width: 100%;
    }
}

</style>
</head>

<body>

<div class="receipt">

    <!-- HEADER -->

    <header class="header">

        <div class="brand">

            <div class="brand-name">
                ${pdfEscape(appName)}
            </div>

            <div class="document-title">
                ${pdfEscape(
            t(
                "sellerPayments.milkCollectionReceipt"
            )
        )}
            </div>

        </div>

        <div class="header-meta">

            <div class="cycle">
                ${pdfDate(activeCycle.from)}
                –
                ${pdfDate(activeCycle.to)}
            </div>

            <div>
                ${pdfEscape(
            t("sellerPayments.billNo")
        )}:
                <span class="bill">
                    ${pdfEscape(sellerObj.bill_no)}
                </span>
            </div>

            <div>
                ${pdfEscape(
            t("sellerPayments.generated")
        )}:
                ${pdfDate(new Date())}
            </div>

        </div>

    </header>


    <!-- SELLER INFORMATION -->

    <div class="info-grid">

        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
            t("sellerPayments.sellerName")
        )}
            </div>

            <div class="info-value">
                ${pdfEscape(sellerObj.name || "—")}
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
            t("sellerPayments.sellerCode")
        )}
            </div>

            <div class="info-value mono">
                ${pdfEscape(
            sellerObj.seller_code || "—"
        )}
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
            t("sellerPayments.status")
        )}
            </div>

            <div
                class="info-value"
                style="
                    color:
                    ${sellerObj.is_paid
                ? PDF_COLORS.success
                : PDF_COLORS.warning};
                "
            >
                ${pdfEscape(
                    sellerObj.is_paid
                        ? t("sellerPayments.paid")
                        : t("sellerPayments.pending")
                )}
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
                    t("sellerPayments.totalEntries")
                )}
            </div>

            <div class="info-value">
                ${entries.length}
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
                    t("sellerPayments.totalQty")
                )}
            </div>

            <div class="info-value">
                ${totalQty.toFixed(2)} L
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
                    t("sellerPayments.morning")
                )}
                /
                ${pdfEscape(
                    t("sellerPayments.evening")
                )}
            </div>

            <div class="info-value">
                ${mQty.toFixed(1)}
                /
                ${eQty.toFixed(1)} L
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
                    t("sellerPayments.cowBuffalo")
                )}
            </div>

            <div class="info-value">
                ${cowQty.toFixed(1)}
                /
                ${buffaloQty.toFixed(1)} L
            </div>
        </div>


        <div class="info-item">
            <div class="info-label">
                ${pdfEscape(
                    t("sellerPayments.avgFat")
                )}
                /
                ${pdfEscape(
                    t("sellerPayments.avgSnf")
                )}
            </div>

            <div class="info-value">
                ${avgFat}
                /
                ${avgSnf}
            </div>
        </div>

    </div>


    <!-- KPI SUMMARY -->

    <div class="kpi-grid">

        <div class="kpi">
            <div class="kpi-label">
                ${pdfEscape(
                    t("sellerPayments.milkAmount")
                )}
            </div>

            <div
                class="kpi-value"
                style="color:${PDF_COLORS.success}"
            >
                ${pdfMoney(milkAmt)}
            </div>
        </div>


        <div class="kpi">
            <div class="kpi-label">
                ${pdfEscape(
                    t("sellerPayments.advancePending")
                )}
            </div>

            <div
                class="kpi-value"
                style="color:${PDF_COLORS.violet}"
            >
                ${pdfMoney(advGiven)}
            </div>

            <div class="kpi-sub">
                ${pdfEscape(
                    t("sellerPayments.openingBalance")
                )}
            </div>
        </div>


        <div class="kpi">
            <div class="kpi-label">
                ${pdfEscape(
                    t("sellerPayments.advanceCut")
                )}
            </div>

            <div
                class="kpi-value"
                style="color:${PDF_COLORS.danger}"
            >
                − ${pdfMoney(installmentCut)}
            </div>

            <div class="kpi-sub">
                ${pdfEscape(
                    t("sellerPayments.installment")
                )}
            </div>
        </div>


        <div class="kpi">
            <div class="kpi-label">
                ${pdfEscape(
                    t("sellerPayments.closingAdvance")
                )}
            </div>

            <div
                class="kpi-value"
                style="color:${PDF_COLORS.violet}"
            >
                ${pdfMoney(closingAdvance)}
            </div>

            <div class="kpi-sub">
                ${pdfEscape(
                    t("sellerPayments.remaining")
                )}
            </div>
        </div>

    </div>


    <!-- DAILY MILK BREAKDOWN -->

    ${entries.length > 0
                ? `
                <section class="section">

                    <div class="section-heading">
                        ${pdfEscape(
                    t(
                        "sellerPayments.dailyEntryBreakdown"
                    )
                )}
                    </div>

                    <table class="milk-table">

                        <thead>

                            <tr>

                                <th rowspan="2" style="width:42px">
                                    ${pdfEscape(
                    t(
                        "sellerPayments.date"
                    )
                )}
                                </th>

                                <th
                                    colspan="7"
                                    class="morning-group"
                                >
                                    ${pdfEscape(
                    t(
                        "sellerPayments.morningShift"
                    )
                )}
                                </th>

                                <th
                                    colspan="7"
                                    class="evening-group"
                                >
                                    ${pdfEscape(
                    t(
                        "sellerPayments.eveningShift"
                    )
                )}
                                </th>

                                <th
                                    rowspan="2"
                                    class="day-total-head"
                                    style="width:58px"
                                >
                                    ${pdfEscape(
                    t(
                        "sellerPayments.dayTotal"
                    )
                )}
                                </th>

                            </tr>

                            <tr>

                                ${[
                    "qtyL",
                    "fat",
                    "snf",
                    "rateBeforeComm",
                    "rateAfterComm",
                    "amt",
                    "ratePerLtr",
                ]
                    .map(
                        key => `
                                            <th class="morning-group">
                                                ${pdfEscape(
                            t(
                                `sellerPayments.${key}`
                            )
                        )}
                                            </th>
                                        `
                    )
                    .join("")}

                                ${[
                    "qtyL",
                    "fat",
                    "snf",
                    "rateBeforeComm",
                    "rateAfterComm",
                    "amt",
                    "ratePerLtr",
                ]
                    .map(
                        key => `
                                            <th class="evening-group">
                                                ${pdfEscape(
                            t(
                                `sellerPayments.${key}`
                            )
                        )}
                                            </th>
                                        `
                    )
                    .join("")}

                            </tr>

                        </thead>

                        <tbody>

                            ${allDates
                    .map(buildRow)
                    .join("")}

                            <tr class="total-row">

                                <td>
                                    ${pdfEscape(
                        t(
                            "sellerPayments.total"
                        )
                    )}
                                </td>

                                <td>
                                    ${mQty.toFixed(2)}
                                </td>

                                <td>
                                    ${mFat.toFixed(1)}
                                </td>

                                <td>
                                    ${mSnf.toFixed(1)}
                                </td>

                                <td>—</td>
                                <td>—</td>

                                <td class="money">
                                    ${mAmt.toFixed(2)}
                                </td>

                                <td>
                                    ${mQty > 0
                    ? (
                        mAmt / mQty
                    ).toFixed(2)
                    : "—"
                }
                                </td>


                                <td>
                                    ${eQty.toFixed(2)}
                                </td>

                                <td>
                                    ${eFat.toFixed(1)}
                                </td>

                                <td>
                                    ${eSnf.toFixed(1)}
                                </td>

                                <td>—</td>
                                <td>—</td>

                                <td class="money">
                                    ${eAmt.toFixed(2)}
                                </td>

                                <td>
                                    ${eQty > 0
                    ? (
                        eAmt / eQty
                    ).toFixed(2)
                    : "—"
                }
                                </td>

                                <td
                                    class="money"
                                    style="
                                        background:
                                        ${PDF_COLORS.primaryLight};
                                        color:
                                        ${PDF_COLORS.primaryDark};
                                    "
                                >
                                    ${milkAmt.toFixed(2)}
                                </td>

                            </tr>

                        </tbody>

                    </table>

                </section>
            `
                : ""
            }


    ${productSalesTable}

    ${cattleFeedTable}

    ${walkinBanner}

    ${commissionBanner}


    <!-- ACCOUNT SUMMARY -->

    <section class="section">

        <div class="section-heading">
            ${pdfEscape(
                t("sellerPayments.accountSummary")
            )}
        </div>


        <div class="account-grid">


            <!-- ADVANCE -->

            <div class="account">

                <div class="account-header">
                    ${pdfEscape(
                t(
                    "sellerPayments.advanceAccount"
                )
            )}
                </div>

                <div class="account-row">
                    <span class="account-label">
                        ${pdfEscape(
                t(
                    "sellerPayments.openingBalance"
                )
            )}
                    </span>

                    <span class="account-value">
                        ${pdfMoney(advGiven)}
                    </span>
                </div>

                <div class="account-row">
                    <span class="account-label">
                        ${pdfEscape(
                t(
                    "sellerPayments.givenThisCycle"
                )
            )}
                    </span>

                    <span class="account-value">
                        ${pdfMoney(0)}
                    </span>
                </div>

                <div
                    class="account-row"
                    style="
                        background:
                        ${PDF_COLORS.dangerBg};
                    "
                >
                    <span class="account-label">
                        ${pdfEscape(
                t(
                    "sellerPayments.installmentCut"
                )
            )}
                    </span>

                    <span
                        class="account-value"
                        style="
                            color:
                            ${PDF_COLORS.danger};
                        "
                    >
                        − ${pdfMoney(installmentCut)}
                    </span>
                </div>

                <div class="account-total">
                    <span>
                        ${pdfEscape(
                t(
                    "sellerPayments.closingBalance"
                )
            )}
                    </span>

                    <span>
                        ${pdfMoney(closingAdvance)}
                    </span>
                </div>

            </div>


            <!-- DEPOSIT -->

            <div class="account">

                <div class="account-header">
                    ${pdfEscape(
                t(
                    "sellerPayments.depositAccount"
                )
            )}
                </div>

                <div class="account-row">
                    <span class="account-label">
                        ${pdfEscape(
                t(
                    "sellerPayments.openingBalance"
                )
            )}
                    </span>

                    <span class="account-value">
                        ${pdfMoney(openingDeposit)}
                    </span>
                </div>

                <div
                    class="account-row"
                    style="
                        background:
                        ${PDF_COLORS.infoBg};
                    "
                >
                    <span class="account-label">
                        ${pdfEscape(
                t(
                    "sellerPayments.addedThisCycle"
                )
            )}
                    </span>

                    <span
                        class="account-value"
                        style="
                            color:
                            ${PDF_COLORS.success};
                        "
                    >
                        + ${pdfMoney(depositAmt)}
                    </span>
                </div>

                <div class="account-row">

                    <span class="account-label">
                        ${totalQty.toFixed(2)} L ×
                        ${pdfMoney(
                sellerObj.deposit_per_litre
            )}/L
                    </span>

                    <span
                        style="
                            font-size:6.5px;
                            color:${PDF_COLORS.muted};
                        "
                    >
                        ${pdfEscape(
                t("sellerPayments.formula")
            )}
                    </span>

                </div>

                <div class="account-total">

                    <span>
                        ${pdfEscape(
                t(
                    "sellerPayments.closingBalance"
                )
            )}
                    </span>

                    <span>
                        ${pdfMoney(closingDeposit)}
                    </span>

                </div>

            </div>


            <!-- PAYMENT -->

            <div class="account">

                <div class="account-header">
                    ${pdfEscape(
                t(
                    "sellerPayments.paymentSummary"
                )
            )}
                </div>

                <div
                    class="account-row"
                    style="
                        background:
                        ${PDF_COLORS.successBg};
                    "
                >
                    <span class="account-label">
                        ${pdfEscape(
                t(
                    "sellerPayments.milkAmount"
                )
            )}
                    </span>

                    <span
                        class="account-value"
                        style="
                            color:
                            ${PDF_COLORS.success};
                        "
                    >
                        + ${pdfMoney(milkAmt)}
                    </span>
                </div>

                ${depositAmt > 0
                ? `
                            <div class="account-row">
                                <span class="account-label">
                                    ${pdfEscape(
                    t(
                        "sellerPayments.depositCut"
                    )
                )}
                                </span>

                                <span
                                    class="account-value"
                                    style="
                                        color:
                                        ${PDF_COLORS.danger};
                                    "
                                >
                                    − ${pdfMoney(depositAmt)}
                                </span>
                            </div>
                        `
                : ""
            }

                ${installmentCut > 0
                ? `
                            <div class="account-row">
                                <span class="account-label">
                                    ${pdfEscape(
                    t(
                        "sellerPayments.advInstallment"
                    )
                )}
                                </span>

                                <span
                                    class="account-value"
                                    style="
                                        color:
                                        ${PDF_COLORS.danger};
                                    "
                                >
                                    − ${pdfMoney(
                    installmentCut
                )}
                                </span>
                            </div>
                        `
                : ""
            }

                ${productDed > 0
                ? `
                            <div class="account-row">
                                <span class="account-label">
                                    ${pdfEscape(
                    t(
                        "sellerPayments.products"
                    )
                )}
                                </span>

                                <span class="account-value">
                                    − ${pdfMoney(productDed)}
                                </span>
                            </div>
                        `
                : ""
            }

                ${cattleFeedDed > 0
                ? `
                            <div class="account-row">
                                <span class="account-label">
                                    ${pdfEscape(
                    t(
                        "sellerPayments.cattleFeed"
                    )
                )}
                                </span>

                                <span class="account-value">
                                    − ${pdfMoney(
                    cattleFeedDed
                )}
                                </span>
                            </div>
                        `
                : ""
            }

                ${walkinDed > 0
                ? `
                            <div class="account-row">
                                <span class="account-label">
                                    ${pdfEscape(
                    t(
                        "sellerPayments.milkBought"
                    )
                )}
                                </span>

                                <span class="account-value">
                                    − ${pdfMoney(walkinDed)}
                                </span>
                            </div>
                        `
                : ""
            }

                <div
                    class="account-total"
                    style="
                        background:
                        ${PDF_COLORS.primaryDark};
                        color:#fff;
                    "
                >
                    <span style="color:#fff">
                        ${pdfEscape(
                t(
                    "sellerPayments.netCashToHand"
                )
            )}
                    </span>

                    <span
                        style="
                            color:#fff;
                            font-family:
                            'Courier New',monospace;
                        "
                    >
                        ${pdfMoney(finalPayable)}
                    </span>
                </div>

            </div>

        </div>

    </section>


    <!-- DETAILED BREAKDOWN -->

    <section class="section">

        <div class="section-heading">
            ${pdfEscape(
                t("sellerPayments.detailedBreakdown")
            )}
        </div>


        <div class="breakdown">

            <div
                class="
                    breakdown-row
                    breakdown-positive
                "
            >
                <span class="breakdown-label">
                    ${pdfEscape(
                t(
                    "sellerPayments.milkAmountPayable"
                )
            )}
                </span>

                <span
                    class="breakdown-value"
                    style="
                        color:
                        ${PDF_COLORS.success};
                    "
                >
                    + ${pdfMoney(milkAmt)}
                </span>
            </div>


            ${advGiven > 0
                ? `
                        <div
                            class="
                                breakdown-row
                                breakdown-info
                            "
                        >
                            <span class="breakdown-label">
                                ${pdfEscape(
                    t(
                        "sellerPayments.openingAdvanceBalance"
                    )
                )}
                            </span>

                            <span class="breakdown-value">
                                ${pdfMoney(advGiven)}
                            </span>
                        </div>
                    `
                : ""
            }


            ${installmentCut > 0
                ? `
                        <div
                            class="
                                breakdown-row
                                breakdown-negative
                            "
                        >
                            <span class="breakdown-label">

                                ${pdfEscape(
                    t(
                        "sellerPayments.advanceInstallmentCut"
                    )
                )}

                                <span class="breakdown-detail">
                                    (
                                    ${pdfMoney(advGiven)}
                                    →
                                    ${pdfMoney(closingAdvance)}
                                    ${pdfEscape(
                    t(
                        "sellerPayments.remaining"
                    )
                )}
                                    )
                                </span>

                            </span>

                            <span
                                class="breakdown-value"
                                style="
                                    color:
                                    ${PDF_COLORS.danger};
                                "
                            >
                                − ${pdfMoney(
                    installmentCut
                )}
                            </span>

                        </div>
                    `
                : ""
            }


            ${depositAmt > 0
                ? `
                        <div
                            class="
                                breakdown-row
                                breakdown-info
                            "
                        >

                            <span class="breakdown-label">

                                ${pdfEscape(
                    t(
                        "sellerPayments.depositDeducted"
                    )
                )}

                                <span class="breakdown-detail">
                                    (
                                    ${totalQty.toFixed(2)}L ×
                                    ${pdfMoney(
                    sellerObj.deposit_per_litre
                )}/L
                                    ·
                                    ${pdfEscape(
                    t(
                        "sellerPayments.balance"
                    )
                )}:
                                    ${pdfMoney(openingDeposit)}
                                    →
                                    ${pdfMoney(closingDeposit)}
                                    )
                                </span>

                            </span>

                            <span
                                class="breakdown-value"
                                style="
                                    color:
                                    ${PDF_COLORS.info};
                                "
                            >
                                − ${pdfMoney(depositAmt)}
                            </span>

                        </div>
                    `
                : ""
            }


            ${productDed > 0
                ? `
                        <div
                            class="
                                breakdown-row
                                breakdown-warning
                            "
                        >
                            <span class="breakdown-label">
                                ${pdfEscape(
                    t(
                        "sellerPayments.productSalesDeduction"
                    )
                )}
                            </span>

                            <span class="breakdown-value">
                                − ${pdfMoney(productDed)}
                            </span>
                        </div>
                    `
                : ""
            }


            ${cattleFeedDed > 0
                ? `
                        <div
                            class="
                                breakdown-row
                                breakdown-positive
                            "
                        >
                            <span class="breakdown-label">
                                ${pdfEscape(
                    t(
                        "sellerPayments.cattleFeedDeduction"
                    )
                )}
                            </span>

                            <span class="breakdown-value">
                                − ${pdfMoney(
                    cattleFeedDed
                )}
                            </span>
                        </div>
                    `
                : ""
            }


            ${walkinDed > 0
                ? `
                        <div
                            class="
                                breakdown-row
                                breakdown-warning
                            "
                        >
                            <span class="breakdown-label">
                                ${pdfEscape(
                    t(
                        "sellerPayments.milkBoughtBySellerWalkin"
                    )
                )}
                            </span>

                            <span class="breakdown-value">
                                − ${pdfMoney(walkinDed)}
                            </span>
                        </div>
                    `
                : ""
            }


            <div class="net-payable">

                <span class="label">
                    ${pdfEscape(
                t(
                    "sellerPayments.netCashToHand"
                )
            )}
                </span>

                <span class="amount">
                    ${pdfMoney(finalPayable)}
                </span>

            </div>

        </div>

    </section>


    <!-- FOOTER -->

    <footer class="footer">

        <span>
            ${pdfEscape(
                t(
                    "sellerPayments.computerGenerated"
                )
            )}
            ·
            ${pdfEscape(appName)}
        </span>

        <span class="footer-right">

            ${sellerObj.is_paid &&
                sellerObj.paid_at
                ? `
                        ${pdfEscape(
                    t(
                        "sellerPayments.paidOn"
                    )
                )}:
                        ${pdfDate(sellerObj.paid_at)}
                    `
                : ""
            }

        </span>

    </footer>

</div>

</body>
</html>`;
    };

    const downloadReceiptPDF = async (seller) => {
        try {
            const html = await buildReceiptHtml(seller);
            if (!html) {
                showFlash("error", t('sellerPayments.receiptGenerationError'));
                return false;
            }
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

    const printReceipt = async (e, seller, overrideCycle) => {
        e?.stopPropagation?.();

        try {
            const activeCycle = overrideCycle || cycle;

            let billData = null;

            if (seller.bill_no) {
                try {
                    const { data } = await api.get(
                        `/payments/bill/${seller.bill_no}`
                    );

                    billData = data;
                } catch (error) {
                    console.error(
                        "Failed to load bill for printing:",
                        error
                    );

                    showFlash(
                        "error",
                        t("sellerPayments.printLoadError")
                    );

                    return;
                }
            }

            const entries =
                billData?.entries ||
                seller.entries ||
                [];

            const sellerForPrint = {
                ...seller,
                entries,

                product_deduction:
                    billData?.payment?.product_deduction ??
                    seller.product_deduction,

                walkin_deduction:
                    billData?.payment?.walkin_deduction ??
                    seller.walkin_deduction,

                cattle_feed_deduction:
                    billData?.payment?.cattle_feed_deduction ??
                    seller.cattle_feed_deduction,

                installment_cut:
                    billData?.payment?.installment_cut ??
                    seller.installment_cut,

                deposit_amount:
                    billData?.payment?.deposit_amount ??
                    seller.deposit_amount,

                deposit_per_litre:
                    billData?.payment?.deposit_per_litre ??
                    seller.deposit_per_litre,

                commission_amount:
                    billData?.payment?.commission_amount ??
                    seller.commission_amount,

                advance_given:
                    billData?.payment?.advance_given ??
                    seller.advance_given,

                opening_deposit:
                    billData?.depositSnapshot?.[0]
                        ?.deposit_balance_before ??
                    seller.deposit_balance ??
                    0,

                final_payable:
                    billData?.payment?.final_payable ??
                    billData?.payment?.cash_paid ??
                    seller.final_payable,

                cash_to_pay:
                    billData?.payment?.cash_paid ??
                    seller.cash_to_pay,

                is_paid: true,

                paid_at:
                    billData?.payment?.paid_at ??
                    seller.paid_at,

                bill_no:
                    seller.bill_no ||
                    generatePreviewBillNo(
                        seller.seller_id,
                        activeCycle.from,
                        activeCycle.to
                    ),
            };

            const htmlContent =
                await buildReceiptHtml(
                    sellerForPrint,
                    activeCycle
                );

            if (!htmlContent) {
                showFlash(
                    "error",
                    t("sellerPayments.pdfGenerationError")
                );

                return;
            }

            const printWindow = window.open(
                "",
                "_blank",
                "width=1200,height=900"
            );

            if (!printWindow) {
                showFlash(
                    "error",
                    t("sellerPayments.popupBlocked")
                );

                return;
            }

            printWindow.document.open();

            // Add automatic print trigger.
            const printableHtml =
                htmlContent.replace(
                    "</body>",
                    `
                    <script>
                        window.addEventListener(
                            "load",
                            function () {
                                setTimeout(
                                    function () {
                                        window.focus();
                                        window.print();
                                    },
                                    350
                                );
                            }
                        );
                    </script>
                </body>
                `
                );

            printWindow.document.write(
                printableHtml
            );

            printWindow.document.close();

        } catch (error) {
            console.error(
                "[SellerPayments] Print error:",
                error
            );

            showFlash(
                "error",
                t("sellerPayments.pdfGenerationError")
            );
        }
    };

    // ── UPDATED: Combined PDF Generation with Minimized Header ──
    const generateCombinedPDF = async (sellers) => {
        try {
            let successCount = 0;
            let failCount = 0;

            const container = document.createElement('div');
            container.style.cssText = `
                position: fixed;
                left: -9999px;
                top: 0;
                width: 1123px;
                background: white;
                padding: 10px 20px;
                font-family: Arial, sans-serif;
                font-size: 8px;
                color: #000;
                z-index: -9999;
            `;
            document.body.appendChild(container);

            let combinedHtml = `
                <style>
                    * { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        box-sizing: border-box;
                    }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 7.5px; 
                        color: #000;
                        margin: 0;
                        padding: 0;
                    }
                    .receipt-page {
                        page-break-after: always;
                        padding: 4px 0;
                        margin-bottom: 2px;
                    }
                    .receipt-page:last-child {
                        page-break-after: avoid;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1.5px solid #000;
                        padding-bottom: 2px;
                        margin-bottom: 3px;
                    }
                    .header-left { 
                        font-size: 9px;
                        font-weight: bold;
                        line-height: 1.1;
                    }
                    .header-left .sub {
                        font-size: 6.5px;
                        font-weight: normal;
                        color: #555;
                    }
                    .header-right {
                        text-align: right;
                        font-size: 6.5px;
                        color: #555;
                        line-height: 1.2;
                    }
                    .header-right .bold {
                        font-weight: bold;
                        font-size: 8px;
                        color: #000;
                    }
                    .compact-info {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr 1fr 1fr 1fr;
                        gap: 2px 6px;
                        background: #f5f5f5;
                        padding: 3px 5px;
                        border-radius: 2px;
                        margin-bottom: 3px;
                        border: 0.5px solid #000000;
                    }
                    .compact-info .item .lbl {
                        font-size: 5.5px;
                        color: #888;
                        text-transform: uppercase;
                        letter-spacing: 0.2px;
                    }
                    .compact-info .item .val {
                        font-size: 7px;
                        font-weight: bold;
                        margin-top: 0;
                        line-height: 1.1;
                    }
                    .summary-compact {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 2px;
                        margin-bottom: 3px;
                    }
                    .summary-box-compact {
                        border: 0.5px solid #000000;
                        border-radius: 2px;
                        padding: 2px 4px;
                        background: #fafafa;
                    }
                    .summary-box-compact .lbl {
                        font-size: 5.5px;
                        color: #888;
                        text-transform: uppercase;
                    }
                    .summary-box-compact .val {
                        font-size: 7.5px;
                        font-weight: bold;
                        margin-top: 0;
                        line-height: 1.1;
                    }
                    .summary-box-compact .sub {
                        font-size: 5.5px;
                        color: #999;
                        margin-top: 0;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-bottom: 2px;
                        font-size: 6.5px;
                    }
                    th, td {
                        border: 1px solid #ccc;
                        padding: 1.5px 2px;
                        text-align: center;
                    }
                    th {
                        background: #e8e8e8;
                        font-weight: bold;
                        font-size: 5.5px;
                        text-transform: uppercase;
                        padding: 1.5px 2px;
                    }
                    .section-title-compact {
                        font-size: 6.5px;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 0.3px;
                        color: #555;
                        margin: 3px 0 1.5px;
                        border-bottom: 1px solid #ddd;
                        padding-bottom: 1px;
                    }
                    .bottom-summary-compact {
                        display: grid;
                        grid-template-columns: 1fr 1fr 1fr;
                        border: 1px solid #ccc;
                        border-radius: 3px;
                        overflow: hidden;
                        margin-bottom: 2px;
                    }
                    .bs-col-compact { padding: 0; }
                    .bs-col-header-compact {
                        background: #222;
                        color: #fff;
                        font-size: 5.5px;
                        font-weight: bold;
                        text-align: center;
                        padding: 1.5px 4px;
                        text-transform: uppercase;
                        letter-spacing: 0.2px;
                    }
                    .bs-row-compact {
                        display: flex;
                        justify-content: space-between;
                        padding: 1.5px 4px;
                        border-bottom: 1px solid #eee;
                        font-size: 6.5px;
                    }
                    .bs-row-compact:last-child { border-bottom: none; }
                    .bs-row-compact .key { color: #666; }
                    .bs-row-compact .val { font-weight: 600; font-family: monospace; }
                    .bs-col-compact + .bs-col-compact { border-left: 1px solid #ccc; }
                    .bs-total-row-compact {
                        display: flex;
                        justify-content: space-between;
                        padding: 2px 4px;
                        font-size: 6.5px;
                        font-weight: bold;
                        border-top: 2px solid #ccc;
                        background: #f5f5f5;
                    }
                    .net-row-compact {
                        display: flex;
                        justify-content: space-between;
                        padding: 3px 5px;
                        background: #222;
                        color: #fff;
                        font-size: 8px;
                        font-weight: bold;
                    }
                    .net-row-compact span { color: #fff !important; }
                    .footer-compact {
                        display: flex;
                        justify-content: space-between;
                        font-size: 5.5px;
                        color: #aaa;
                        padding-top: 2px;
                        border-top: 1px solid #eee;
                        margin-top: 2px;
                    }
                    .banner-compact {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 2px 5px;
                        border-radius: 2px;
                        margin-bottom: 2px;
                        font-size: 6.5px;
                    }
                    .banner-compact .label { font-weight: 600; }
                    .banner-compact .amount { font-weight: 700; }
                    .commission-banner { background: #faf5ff; border: 1px solid #e9d5ff; }
                    .commission-banner .label { color: #7c3aed; }
                    .commission-banner .amount { color: #7c3aed; }
                    .walkin-banner { background: #fff7ed; border: 1px solid #fed7aa; }
                    .walkin-banner .label { color: #9a3412; }
                    .walkin-banner .amount { color: #ea580c; }
                </style>
            `;

            for (const seller of sellers) {
                try {
                    let billData = null;
                    if (seller.bill_no) {
                        try {
                            const { data } = await api.get(`/payments/bill/${seller.bill_no}`);
                            billData = data;
                        } catch (e) {
                            console.error('Error fetching bill data:', e);
                        }
                    }

                    const entries = billData?.entries || seller.entries || [];
                    const productSales = billData?.productSales || [];
                    const cattleFeedSales = billData?.cattleFeedSales || [];

                    const sellerObj = {
                        ...seller,
                        entries,
                        bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, cycle.from, cycle.to),
                        milk_amount: billData?.payment?.milk_amount ?? seller.milk_amount,
                        product_deduction: billData?.payment?.product_deduction ?? seller.product_deduction,
                        walkin_deduction: billData?.payment?.walkin_deduction ?? seller.walkin_deduction,
                        cattle_feed_deduction: billData?.payment?.cattle_feed_deduction ?? seller.cattle_feed_deduction,
                        installment_cut: billData?.payment?.installment_cut ?? seller.installment_cut,
                        deposit_amount: billData?.payment?.deposit_amount ?? seller.deposit_amount,
                        deposit_per_litre: billData?.payment?.deposit_per_litre ?? seller.deposit_per_litre,
                        commission_amount: billData?.payment?.commission_amount ?? seller.commission_amount,
                        advance_given: billData?.payment?.advance_given ?? seller.advance_given,
                        opening_deposit: billData?.depositSnapshot?.[0]?.deposit_balance_before ?? seller.deposit_balance ?? 0,
                        final_payable: billData?.payment?.final_payable ?? billData?.payment?.cash_paid ?? seller.final_payable,
                        cash_to_pay: billData?.payment?.cash_paid ?? seller.cash_to_pay,
                        is_paid: true,
                        paid_at: billData?.payment?.paid_at || seller.paid_at,
                        total_milk_quantity: entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0),
                    };

                    const milkAmt = parseFloat(sellerObj.milk_amount || 0);
                    const depositAmt = parseFloat(sellerObj.deposit_amount || 0);
                    const installmentCut = parseFloat(sellerObj.installment_cut || 0);
                    const productDed = parseFloat(sellerObj.product_deduction || 0);
                    const walkinDed = parseFloat(sellerObj.walkin_deduction || 0);
                    const cattleFeedDed = parseFloat(sellerObj.cattle_feed_deduction || 0);
                    const advGiven = parseFloat(sellerObj.advance_given || 0);
                    const openingDeposit = parseFloat(sellerObj.opening_deposit || 0);
                    const finalPayable = Math.max(0, parseFloat(sellerObj.final_payable || sellerObj.cash_to_pay || 0));
                    const totalQty = entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                    const commissionAmt = parseFloat(sellerObj.commission_amount || 0);

                    const fmtR = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
                    const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

                    // Build entry rows - limit to 6 entries
                    let entryRows = '';
                    const displayEntries = entries.slice(0, 6);
                    const hasMoreEntries = entries.length > 6;

                    displayEntries.forEach((e, i) => {
                        const date = new Date(e.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
                        const shift = e.shift === "morning" ? "M" : "E";
                        const type = e.milk_type === "cow" ? "C" : "B";
                        const qty = parseFloat(e.quantity || 0).toFixed(1);
                        const fat = parseFloat(e.fat || 0).toFixed(1);
                        const snf = parseFloat(e.snf || 0).toFixed(1);
                        const rate = parseFloat(e.rate_applied || 0).toFixed(2);
                        const amt = parseFloat(e.total_amount || 0).toFixed(2);
                        const bg = i % 2 === 0 ? '#fff' : '#f9f9f9';
                        entryRows += `
                            <tr style="background:${bg}">
                                <td style="font-size:6px">${date}</td>
                                <td style="font-size:6px">${shift}</td>
                                <td style="font-size:6px">${type}</td>
                                <td style="font-size:6px;font-weight:600">${qty}</td>
                                <td style="font-size:6px">${fat}</td>
                                <td style="font-size:6px">${snf}</td>
                                <td style="font-size:6px">${rate}</td>
                                <td style="font-size:6px;font-weight:600;text-align:right">${amt}</td>
                            </tr>
                        `;
                    });

                    if (hasMoreEntries) {
                        entryRows += `
                            <tr style="background:#f0f0f0;font-style:italic;">
                                <td colspan="7" style="text-align:center;color:#999;font-size:5.5px;">+ ${entries.length - 6} more</td>
                                <td></td>
                            </tr>
                        `;
                    }

                    // Build product sales rows - limit to 3
                    let productRows = '';
                    if (productSales.length > 0) {
                        productSales.slice(0, 3).forEach((p, i) => {
                            const bg = i % 2 === 0 ? '#fff' : '#f9f9f9';
                            productRows += `
                                <tr style="background:${bg}">
                                    <td style="text-align:left;font-size:6px">${p.product_name || 'Unknown'}</td>
                                    <td style="font-size:6px">${parseFloat(p.quantity || 0).toFixed(2)}</td>
                                    <td style="font-size:6px;text-align:right">${fmtR(p.total_amount)}</td>
                                </tr>
                            `;
                        });
                        if (productSales.length > 3) {
                            productRows += `
                                <tr style="background:#f5f5f5;font-style:italic;">
                                    <td colspan="3" style="text-align:center;color:#999;font-size:5.5px;">+ ${productSales.length - 3} more</td>
                                </tr>
                            `;
                        }
                    }

                    // Build cattle feed rows - limit to 2
                    let cattleRows = '';
                    if (cattleFeedSales.length > 0) {
                        cattleFeedSales.slice(0, 2).forEach((f, i) => {
                            const bg = i % 2 === 0 ? '#fff' : '#f9f9f9';
                            cattleRows += `
                                <tr style="background:${bg}">
                                    <td style="text-align:left;font-size:6px">${f.feed_name || 'Unknown'}</td>
                                    <td style="font-size:6px">${parseFloat(f.quantity || 0).toFixed(2)}</td>
                                    <td style="font-size:6px;text-align:right">${fmtR(f.total_amount)}</td>
                                </tr>
                            `;
                        });
                        if (cattleFeedSales.length > 2) {
                            cattleRows += `
                                <tr style="background:#f5f5f5;font-style:italic;">
                                    <td colspan="3" style="text-align:center;color:#999;font-size:5.5px;">+ ${cattleFeedSales.length - 2} more</td>
                                </tr>
                            `;
                        }
                    }

                    const totalCowQty = entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                    const totalBuffQty = entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                    const avgFat = entries.length ? (entries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / entries.length).toFixed(1) : '0.0';
                    const avgSnf = entries.length ? (entries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / entries.length).toFixed(1) : '0.0';

                    const receiptHtml = `
                        <div class="receipt-page">
                            <!-- Header -->
                            <div class="header">
                                <div class="header-left">
                                    ${appName}
                                    <div class="sub">${t('sellerPayments.milkCollectionReceipt')}</div>
                                </div>
                                <div class="header-right">
                                    <div class="bold">${fmtD(cycle.from)} – ${fmtD(cycle.to)}</div>
                                    <div>${t('sellerPayments.billNo')}: <strong style="color:#000">${sellerObj.bill_no}</strong></div>
                                    <div>${t('sellerPayments.generated')}: ${fmtD(new Date())}</div>
                                </div>
                            </div>

                            <!-- Compact Info Row - Everything in one row -->
                            <div class="compact-info">
                                <div class="item">
                                    <div class="lbl">${t('sellerPayments.sellerName')}</div>
                                    <div class="val">${sellerObj.name}</div>
                                </div>
                                <div class="item">
                                    <div class="lbl">${t('sellerPayments.sellerCode')}</div>
                                    <div class="val" style="font-family:monospace">${sellerObj.seller_code}</div>
                                </div>
                                <div class="item">
                                    <div class="lbl">${t('sellerPayments.totalQty')}</div>
                                    <div class="val">${totalQty.toFixed(1)}L</div>
                                </div>
                                <div class="item">
                                    <div class="lbl">${t('sellerPayments.cowBuffalo')}</div>
                                    <div class="val">${totalCowQty.toFixed(1)}/${totalBuffQty.toFixed(1)}L</div>
                                </div>
                                <div class="item">
                                    <div class="lbl">${t('sellerPayments.avgFat')}</div>
                                    <div class="val">${avgFat}%</div>
                                </div>
                                <div class="item">
                                    <div class="lbl">${t('sellerPayments.avgSnf')}</div>
                                    <div class="val">${avgSnf}</div>
                                </div>
                            </div>

                            <!-- Entries Table -->
                            ${entries.length > 0 ? `
                                <div class="section-title-compact">${t('sellerPayments.dailyEntryBreakdown')}</div>
                                <table>
                                    <thead>
                                        <tr>
                                            <th style="width:35px">${t('sellerPayments.date')}</th>
                                            <th style="width:18px">${t('sellerPayments.shift')}</th>
                                            <th style="width:18px">${t('sellerPayments.type')}</th>
                                            <th style="width:22px">${t('sellerPayments.qtyL')}</th>
                                            <th style="width:18px">${t('sellerPayments.fat')}</th>
                                            <th style="width:18px">${t('sellerPayments.snf')}</th>
                                            <th style="width:25px">${t('sellerPayments.rate')}</th>
                                            <th style="width:30px">${t('sellerPayments.amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${entryRows}
                                        <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #ccc;">
                                            <td colspan="3" style="text-align:right;font-size:6px">${t('sellerPayments.total')}</td>
                                            <td style="font-weight:700;font-size:6px">${totalQty.toFixed(1)}</td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td style="text-align:right;font-weight:700;font-size:6px">${fmtR(milkAmt)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ` : ''}

                            <!-- Product Sales -->
                            ${productRows ? `
                                <div class="section-title-compact">${t('sellerPayments.productSalesDeductions')}</div>
                                <table style="margin-bottom:1.5px;">
                                    <thead>
                                        <tr>
                                            <th style="text-align:left;font-size:5.5px">${t('sellerPayments.product')}</th>
                                            <th style="font-size:5.5px">${t('sellerPayments.qty')}</th>
                                            <th style="text-align:right;font-size:5.5px">${t('sellerPayments.amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${productRows}
                                        <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #ccc;">
                                            <td colspan="2" style="text-align:right;font-size:6px">${t('sellerPayments.total')}</td>
                                            <td style="text-align:right;font-size:6px">${fmtR(productDed)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ` : ''}

                            <!-- Cattle Feed -->
                            ${cattleRows ? `
                                <div class="section-title-compact">${t('sellerPayments.cattleFeedDeductions')}</div>
                                <table style="margin-bottom:1.5px;">
                                    <thead>
                                        <tr>
                                            <th style="text-align:left;font-size:5.5px">${t('sellerPayments.feed')}</th>
                                            <th style="font-size:5.5px">${t('sellerPayments.qty')}</th>
                                            <th style="text-align:right;font-size:5.5px">${t('sellerPayments.amount')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${cattleRows}
                                        <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #ccc;">
                                            <td colspan="2" style="text-align:right;font-size:6px">${t('sellerPayments.total')}</td>
                                            <td style="text-align:right;font-size:6px">${fmtR(cattleFeedDed)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            ` : ''}

                            <!-- Walk-in Banner -->
                            ${walkinDed > 0 ? `
                                <div class="banner-compact walkin-banner">
                                    <span class="label">${t('sellerPayments.milkBoughtBySeller')}</span>
                                    <span class="amount">${fmtR(walkinDed)}</span>
                                </div>
                            ` : ''}

                            <!-- Commission Banner -->
                            ${commissionAmt > 0 ? `
                                <div class="banner-compact commission-banner">
                                    <span class="label">${t('sellerPayments.gavaliCommissionIncluded') || 'Gavali Commission'}</span>
                                    <span class="amount">+ ${fmtR(commissionAmt)}</span>
                                </div>
                            ` : ''}

                            <!-- Account Summary -->
                            <div class="section-title-compact">${t('sellerPayments.accountSummary')}</div>
                            <div class="bottom-summary-compact">
                                <div class="bs-col-compact">
                                    <div class="bs-col-header-compact">${t('sellerPayments.advanceAccount')}</div>
                                    <div class="bs-row-compact">
                                        <span class="key">${t('sellerPayments.openingBalance')}</span>
                                        <span class="val">${fmtR(advGiven)}</span>
                                    </div>
                                    <div class="bs-row-compact" style="background:#faf5ff;">
                                        <span class="key">${t('sellerPayments.installmentCut')}</span>
                                        <span class="val">− ${fmtR(installmentCut)}</span>
                                    </div>
                                    <div class="bs-total-row-compact">
                                        <span>${t('sellerPayments.closingBalance')}</span>
                                        <span>${fmtR(Math.max(0, advGiven - installmentCut))}</span>
                                    </div>
                                </div>
                                <div class="bs-col-compact">
                                    <div class="bs-col-header-compact">${t('sellerPayments.depositAccount')}</div>
                                    <div class="bs-row-compact">
                                        <span class="key">${t('sellerPayments.openingBalance')}</span>
                                        <span class="val">${fmtR(openingDeposit)}</span>
                                    </div>
                                    <div class="bs-row-compact" style="background:#eff6ff;">
                                        <span class="key">${t('sellerPayments.addedThisCycle')}</span>
                                        <span class="val">+ ${fmtR(depositAmt)}</span>
                                    </div>
                                    <div class="bs-total-row-compact">
                                        <span>${t('sellerPayments.closingBalance')}</span>
                                        <span>${fmtR(openingDeposit + depositAmt)}</span>
                                    </div>
                                </div>
                                <div class="bs-col-compact">
                                    <div class="bs-col-header-compact">${t('sellerPayments.paymentSummary')}</div>
                                    <div class="bs-row-compact" style="background:#f0fdf4;">
                                        <span class="key">${t('sellerPayments.milkAmount')}</span>
                                        <span class="val">+ ${fmtR(milkAmt)}</span>
                                    </div>
                                    ${depositAmt > 0 ? `<div class="bs-row-compact"><span class="key">${t('sellerPayments.depositCut')}</span><span class="val">− ${fmtR(depositAmt)}</span></div>` : ''}
                                    ${installmentCut > 0 ? `<div class="bs-row-compact"><span class="key">${t('sellerPayments.advInstallment')}</span><span class="val">− ${fmtR(installmentCut)}</span></div>` : ''}
                                    ${productDed > 0 ? `<div class="bs-row-compact"><span class="key">${t('sellerPayments.products')}</span><span class="val">− ${fmtR(productDed)}</span></div>` : ''}
                                    ${cattleFeedDed > 0 ? `<div class="bs-row-compact"><span class="key">${t('sellerPayments.cattleFeed')}</span><span class="val">− ${fmtR(cattleFeedDed)}</span></div>` : ''}
                                    ${walkinDed > 0 ? `<div class="bs-row-compact"><span class="key">${t('sellerPayments.milkBought')}</span><span class="val">− ${fmtR(walkinDed)}</span></div>` : ''}
                                </div>
                            </div>

                            <!-- Net Payable -->
                            <div class="net-row-compact">
                                <span>${t('sellerPayments.netCashToHand')}</span>
                                <span style="font-family:monospace;font-size:9px;">${fmtR(finalPayable)}</span>
                            </div>

                            <!-- Footer -->
                            <div class="footer-compact">
                                <span>${t('sellerPayments.computerGenerated')} · ${appName}</span>
                                ${sellerObj.paid_at ? `<span>${t('sellerPayments.paidOn')}: ${fmtD(sellerObj.paid_at)}</span>` : ''}
                            </div>
                        </div>
                    `;

                    combinedHtml += receiptHtml;
                    successCount++;

                } catch (err) {
                    console.error('Error processing seller:', err);
                    failCount++;
                }
            }

            container.innerHTML = combinedHtml;

            await new Promise(resolve => setTimeout(resolve, 800));

            const canvas = await html2canvas(container, {
                scale: 2.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 1123,
                height: container.scrollHeight,
            });

            document.body.removeChild(container);

            const imgWidth = 297;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const pageHeight = 210; // combined receipts can genuinely span multiple sellers/pages
            const pdf = new jsPDF('l', 'mm', 'a4');

            let heightLeft = imgHeight;
            let position = 0;

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
            heightLeft -= pageHeight;

            while (heightLeft > 5) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;
            }

            const fromDate = cycle.from ? new Date(cycle.from).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/[/, ]/g, '_') : 'draft';
            const toDate = cycle.to ? new Date(cycle.to).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/[/, ]/g, '_') : 'draft';
            const fileName = `Combined_Receipts_${fromDate}_to_${toDate}.pdf`;
            pdf.save(fileName);

            return { successCount, failCount };

        } catch (error) {
            console.error('Combined PDF generation error:', error);
            return { successCount: 0, failCount: 1 };
        }
    };

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
            showFlash("info", `Preparing ${paidSellers.length} PDF receipts...`);

            for (let index = 0; index < paidSellers.length; index++) {
                const seller = paidSellers[index];
                const sellerWithBillNo = {
                    ...seller,
                    bill_no: seller.bill_no || generatePreviewBillNo(seller.seller_id, cycle.from, cycle.to),
                };

                if (index % 5 === 0 && index > 0) {
                    showFlash("info", `Downloading ${index + 1}/${paidSellers.length} receipts...`);
                }

                const success = await downloadReceiptPDF(sellerWithBillNo);
                if (success) {
                    successCount++;
                } else {
                    failCount++;
                }
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

    const handleCombinedDownload = async () => {
        const paidSellers = sellers.filter(s => !!(s.is_paid || s.bill_no) && parseFloat(s.milk_amount || 0) > 0);
        if (paidSellers.length === 0) {
            showFlash("error", t('sellerPayments.noPaidSellersToDownload') || "No paid sellers to download.");
            return;
        }

        if (paidSellers.length > 20) {
            if (!window.confirm(`This will combine ${paidSellers.length} receipts into a single PDF. This may take a moment. Continue?`)) {
                return;
            }
        }

        setCombinedDownloading(true);
        try {
            showFlash("info", `Preparing combined PDF with ${paidSellers.length} receipts...`);

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
            cattle_feed_deduction: payment.cattle_feed_deduction,
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
            const cattleFeedDed = parseFloat(s.cattle_feed_deduction || 0);
            const finalPayable = parseFloat(s.final_payable || s.cash_to_pay || 0);
            const totalQty = (s.entries || []).reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
            const billNo = s.bill_no || "N/A";

            const advClosing = Math.max(0, advGiven - installmentCut);
            const depositOpening = Math.max(0, parseFloat(s.deposit_balance ?? 0) - depositAmt);
            const depositClosing = depositOpening + depositAmt;
            const pendTotal = productDed + walkinDed + cattleFeedDed;

            const bg = i % 2 === 0 ? "#ffffff" : "#f9fafb";
            const subBg = i % 2 === 0 ? "#f3f4f6" : "#eef0f3";

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

            const pendRow = `
<tr style="background:${subBg}">
    <td style="padding:1px 7px 1px 10px;border-left:1px solid #d1d5db;border-right:none;
               font-size:9px;color:#6b7280;text-align:right;font-style:italic;white-space:nowrap">
        Bought:
    </td>
    <td style="padding:1px 7px;border-right:1px solid #d1d5db;font-size:9px;
               font-family:monospace;">
        ${pendTotal > 0
                    ? `<span style="color:#d97706">${productDed > 0 ? `${fmtR(productDed)} ` : ""}</span><span style="color:#ea580c">${walkinDed > 0 ? `${fmtR(walkinDed)} ` : ""}</span><span style="color:#065f46">${cattleFeedDed > 0 ? fmtR(cattleFeedDed) : ""}</span><span style="font-weight:600;color:#000"> = ${fmtR(pendTotal)}</span>`
                    : `<span style="color:#d1d5db">—</span>`}
    </td>
    <td colspan="6" style="border-right:1px solid #d1d5db;border-bottom:none"></td>
</tr>`;

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

    const activeSellers = sellers.filter(s => parseFloat(s.milk_amount || 0) > 0);
    const totalMilk = activeSellers.reduce((a, s) => a + parseFloat(s.milk_amount || 0), 0);
    const totalAdvance = activeSellers.reduce((a, s) => a + parseFloat(s.advance_given || 0), 0);
    const totalDeduction = activeSellers.reduce((a, s) => a + parseFloat(s.deduction_amount || 0), 0);
    const totalProductDeduction = activeSellers.reduce((a, s) => a + parseFloat(s.product_deduction || 0), 0);
    const totalCattleFeedDeduction = activeSellers.reduce((a, s) => a + parseFloat(s.cattle_feed_deduction || 0), 0);
    const totalFinal = activeSellers.reduce((a, s) => a + getEffectiveFinalPayable(s), 0);
    const paidCount = activeSellers.filter(s => !!(s.is_paid || s.bill_no)).length;

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!cycleConfigLoaded) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('seller_payments', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
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
                    * {
                        color: #000000 !important;
                        background-color: transparent !important;
                    }
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
                    th, td, .summary-box, .bottom-summary, .bs-col {
                        border-color: #000000 !important;
                    }
                }
            `}</style>

            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                                <Home size={16} className="text-gray-400" />
                                <span>{t('sellerPayments.pageBreadcrumb', { defaultValue: 'Milk Collection' })}</span>
                                <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                    <Settings size={12} /> {t('status.admin')}
                                </span>
                            </div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent leading-tight">
                                {t('sellerPayments.pageTitle')}
                            </h1>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {t('rateChart.pageSubtitle')} — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap" data-tour="header-actions">
                        <button onClick={startSellerPaymentsTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-gray-100/80 text-gray-600 hover:bg-gray-200/80 transition shadow-sm">
                            <BadgeCheck size={13} /> {t('sellerPayments.startTour') || 'Take a Tour'}
                        </button>
                        <button onClick={() => { setBillSearchOpen(true); searchBills(""); }}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-violet-600 text-white hover:bg-violet-700 transition shadow-lg shadow-violet-600/20">
                            <FileSearch size={13} /> {t('sellerPayments.searchBills')}
                        </button>
                        <button onClick={() => navigate('/commission-settings')}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-amber-100/80 text-amber-700 hover:bg-amber-200/80 transition border border-amber-200/60 shadow-sm">
                            <Percent size={13} /> {t('sellerPayments.commissionSettings') || 'Commission Settings'}
                        </button>
                        {useCustomCycle && (
                            <button onClick={() => setCycleConfigOpen(true)}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-violet-100/80 text-violet-700 hover:bg-violet-200/80 transition border border-violet-200/60 shadow-sm">
                                <Calendar size={13} /> {t('sellerPayments.configureCycle') || 'Configure Cycle'}
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button onClick={printRegister}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-gray-900 text-white hover:bg-gray-800 transition shadow-lg shadow-gray-900/20">
                                <Printer size={13} /> {t('sellerPayments.printRegister')}
                            </button>
                        )}
                        {can('seller_payments', 'R') && (
                            <button onClick={handleBulkDownloadPDFs} disabled={bulkDownloading}
                                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                    bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50 shadow-lg shadow-indigo-600/20">
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
                                    bg-purple-600 text-white hover:bg-purple-700 transition disabled:opacity-50 shadow-lg shadow-purple-600/20">
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
                                    bg-emerald-100/80 text-emerald-700 hover:bg-emerald-200/80 transition border border-emerald-200/60 shadow-sm">
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
                                    bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20">
                                <Download size={13} /> Export Excel
                            </button>
                        )}
                    </div>
                </div>

                {/* Date Range */}
                <div className="flex flex-col gap-3 no-print bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4" data-tour="date-range">

                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                            <button type="button" onClick={() => handleCycleModeToggle(false)}
                                className={`px-3 py-2 transition-all duration-200 ${!useCustomCycle ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                {t('sellerPayments.fixedMonthly') || 'Fixed Monthly'}
                            </button>
                            <button type="button" onClick={() => handleCycleModeToggle(true)}
                                className={`px-3 py-2 transition-all duration-200 ${useCustomCycle ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                {t('sellerPayments.customCycle') || 'Custom Cycle'}
                            </button>
                        </div>

                        {!useCustomCycle && (
                            <div className="flex items-center gap-1.5">
                                {fixedCycles.map((c, idx) => (
                                    <button key={c.label} type="button" onClick={() => selectFixedCycle(idx)}
                                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200
                                            ${activeFixedIdx === idx
                                                ? "bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-600/20"
                                                : "bg-white/50 text-gray-500 border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50"}`}>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.from')}</span>
                            <input type="date" value={customFrom || ''}
                                disabled={!useCustomCycle}
                                onChange={e => setCustomFrom(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/20 transition shadow-sm disabled:bg-gray-50/50 disabled:text-gray-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.to')}</span>
                            <input type="date" value={customTo || ''}
                                disabled={!useCustomCycle}
                                onChange={e => setCustomTo(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/20 transition shadow-sm disabled:bg-gray-50/50 disabled:text-gray-400" />
                        </div>
                        <div className="flex flex-col gap-0.5 ml-4 pl-4 border-l border-gray-200/60">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('sellerPayments.paymentDate')}</span>
                            <input type="date" value={simulatedToday}
                                onChange={e => setSimulatedToday(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/20 transition shadow-sm" />
                        </div>
                    </div>
                </div>

                <div className="hidden print:block mb-2">
                    <h2 className="text-xl font-bold">{t('sellerPayments.sellerPaymentSummary')}</h2>
                    <p className="text-sm text-gray-500">{fmtDate(cycle.from)} to {fmtDate(cycle.to)}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-tour="payment-stats">
                    <StatCard label={t('sellerPayments.totalSellers')} value={activeSellers.length}
                        icon={<Users size={14} />}
                        color="from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700" />
                    <StatCard label={t('sellerPayments.milkAmount')} value={fmt(totalMilk)}
                        icon={<Milk size={14} />}
                        color="from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" />
                    <StatCard label={t('sellerPayments.advanceTaken')} value={fmt(totalAdvance)}
                        sub={t('sellerPayments.infoOnly')}
                        icon={<Banknote size={14} />}
                        color="from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700" />
                    <StatCard label={t('sellerPayments.productDeduction')} value={fmt(totalProductDeduction)}
                        sub={t('sellerPayments.productSalesCut')}
                        icon={<Banknote size={14} />}
                        color="from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600" />
                    <StatCard label={t('sellerPayments.cattleFeedDeduction')} value={fmt(totalCattleFeedDeduction)}
                        sub={t('sellerPayments.cattleFeedCut')}
                        icon={<Banknote size={14} />}
                        color="from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700" />
                </div>

                {/* Progress bar */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4 flex items-center gap-4 no-print">
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
                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50/80 border border-emerald-200/60 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={13} />
                        {activeSellers.length > 0 ? Math.round((paidCount / activeSellers.length) * 100) : 0}% {t('sellerPayments.done')}
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success"
                            ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : flash.type === "error"
                                ? "bg-rose-50/80 border border-rose-200/60 text-rose-600"
                                : "bg-blue-50/80 border border-blue-200/60 text-blue-700"}`}>
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
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/20 transition shadow-sm placeholder:text-gray-300" />
                    </div>
                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                        {[
                            ["all", t('sellerPayments.all')],
                            ["unpaid", t('sellerPayments.unpaid')],
                            ["paid", t('sellerPayments.paid')]
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterPaid(v)}
                                className={`px-3 py-2 transition-all duration-200
                                    ${filterPaid === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Seller Cards */}
                <div className="flex flex-col gap-3" data-tour="seller-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 gap-2 text-gray-300">
                            <Wallet size={32} />
                            <p className="text-sm">{t('sellerPayments.noSellersFound')}</p>
                        </div>
                    ) : paginatedSellers.map(seller => {
                        const entries = seller.entries || [];
                        const isOpen = expanded[seller.seller_id];
                        const milkAmt = parseFloat(seller.milk_amount || 0);
                        const advGiven = parseFloat(seller.advance_given || 0);
                        const isPaid = !!(seller.is_paid || seller.bill_no);
                        const effectiveInstallmentCut = isPaid
                            ? parseFloat(seller.installment_cut || 0)
                            : getEffectiveInstallmentCut(seller);
                        const hasCutOverride = !isPaid &&
                            customCutOverrides[seller.seller_id] !== undefined &&
                            customCutOverrides[seller.seller_id] !== "";
                        const finalPayable = getEffectiveFinalPayable(seller);
                        const cattleFeedDed = parseFloat(seller.cattle_feed_deduction || 0);
                        return (
                            <div key={seller.seller_id}
                                className={`bg-white/80 backdrop-blur-sm rounded-2xl border transition-all shadow-lg shadow-gray-200/50 hover:shadow-xl print-break
                                    ${isPaid ? "border-emerald-200/60" : "border-gray-200/60"}`}>

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

                                    <div className="hidden sm:flex items-center gap-6 text-right mr-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('sellerPayments.milk')}</p>
                                            <p className="text-sm font-semibold text-gray-700">{fmt(milkAmt)}</p>
                                        </div>
                                        {seller.seller_type === 'Gavali' && parseFloat(seller.commission_amount || 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] text-fuchsia-400 uppercase tracking-wider">{t('sellerPayments.commission') || 'Commission'}</p>
                                                <p className="text-sm font-semibold text-fuchsia-500">+ {fmt(seller.commission_amount)}</p>
                                            </div>
                                        )}
                                        {advGiven > 0 && (
                                            <div>
                                                <p className="text-[10px] text-violet-400 uppercase tracking-wider">{t('sellerPayments.advPending')}</p>
                                                <p className="text-sm font-semibold text-violet-500">{fmt(advGiven)}</p>
                                            </div>
                                        )}
                                        {effectiveInstallmentCut > 0 && (
                                            <div>
                                                <p className="text-[10px] text-rose-400 uppercase tracking-wider">
                                                    {t('sellerPayments.advInstCut')}
                                                    {hasCutOverride && <span className="ml-1 text-violet-500">· custom</span>}
                                                </p>
                                                <p className="text-sm font-semibold text-rose-500">− {fmt(effectiveInstallmentCut)}</p>
                                            </div>
                                        )}
                                        {parseFloat(seller.deposit_amount || 0) > 0 && (
                                            <div>
                                                <p className="text-[10px] text-blue-400 uppercase tracking-wider">{t('sellerPayments.depositCut')}</p>
                                                <p className="text-sm font-semibold text-blue-500">− {fmt(seller.deposit_amount)}</p>
                                            </div>
                                        )}
                                        {cattleFeedDed > 0 && (
                                            <div>
                                                <p className="text-[10px] text-emerald-400 uppercase tracking-wider">{t('sellerPayments.cattleFeed')}</p>
                                                <p className="text-sm font-semibold text-emerald-500">− {fmt(cattleFeedDed)}</p>
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
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition disabled:opacity-50 shadow-lg shadow-rose-500/20">
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
                                            className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition shadow-lg shadow-gray-800/20">
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
                                                disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/20">
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

                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs flex-wrap">
                                    <span className="text-gray-400">{t('sellerPayments.milk')}: <strong className="text-gray-700">{fmt(milkAmt)}</strong></span>
                                    {seller.seller_type === 'Gavali' && parseFloat(seller.commission_amount || 0) > 0 && (
                                        <span className="text-fuchsia-500">{t('sellerPayments.commission') || 'Commission'}: +{fmt(seller.commission_amount)}</span>
                                    )}
                                    {advGiven > 0 && <span className="text-violet-500">{t('sellerPayments.adv')}: {fmt(advGiven)}</span>}
                                    {effectiveInstallmentCut > 0 && <span className="text-rose-500">{t('sellerPayments.advInstCut')}: −{fmt(effectiveInstallmentCut)}{hasCutOverride ? " (custom)" : ""}</span>}
                                    {parseFloat(seller.deposit_amount || 0) > 0 && <span className="text-blue-500">{t('sellerPayments.dep')}: −{fmt(seller.deposit_amount)}</span>}
                                    {cattleFeedDed > 0 && <span className="text-emerald-500">{t('sellerPayments.cattleFeed')}: −{fmt(cattleFeedDed)}</span>}
                                    {parseFloat(seller.walkin_deduction || 0) > 0 && <span className="text-rose-500">{t('sellerPayments.bought')}: −{fmt(seller.walkin_deduction)}</span>}
                                    <span className="font-bold text-gray-900">{t('sellerPayments.cash')}: {fmt(finalPayable)}</span>
                                </div>

                                {isOpen && (
                                    <div className="border-t border-gray-100/60 px-5 py-4 flex flex-col gap-4">

                                        {entries.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                                                    {t('sellerPayments.dailyMilkEntries')}
                                                </p>
                                                <div className="rounded-xl border border-gray-100/60 overflow-hidden">
                                                    <div className="grid bg-gray-50/80 border-b border-gray-100/60"
                                                        style={{ gridTemplateColumns: "100px 80px 70px 65px 65px 65px 65px 95px" }}>
                                                        {[t('sellerPayments.date'), t('sellerPayments.shift'), t('sellerPayments.qtyL'), t('sellerPayments.fat'), t('sellerPayments.snf'), t('sellerPayments.rateBeforeComm'), t('sellerPayments.rateAfterComm'), t('sellerPayments.amount')].map(h => (
                                                            <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                        ))}
                                                    </div>
                                                    {entries.map((e, i) => {
                                                        const baseRate = parseFloat(e.base_rate || e.rate_applied || 0);
                                                        const finalRate = parseFloat(e.rate_applied || 0);
                                                        return (
                                                            <div key={i}
                                                                className="grid border-b border-gray-50 last:border-b-0 hover:bg-gray-50/50 transition"
                                                                style={{ gridTemplateColumns: "100px 80px 70px 65px 65px 65px 65px 95px" }}>
                                                                <div className="px-3 py-2 text-xs text-gray-600">{fmtDate(e.entry_date)}</div>
                                                                <div className="px-3 py-2">
                                                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                                                        ${e.shift === "morning" ? "bg-yellow-50 text-yellow-700" : "bg-indigo-50 text-indigo-600"}`}>
                                                                        {e.shift === "morning" ? t('sellerPayments.morning') : t('sellerPayments.evening')}
                                                                    </span>
                                                                </div>
                                                                <div className="px-3 py-2 text-xs text-blue-600 font-mono font-semibold">{e.quantity}</div>
                                                                <div className="px-3 py-2 text-xs text-amber-600 font-mono">{e.fat}</div>
                                                                <div className="px-3 py-2 text-xs text-violet-600 font-mono">{e.snf}</div>
                                                                <div className="px-3 py-2 text-xs text-gray-500 font-mono">₹{baseRate.toFixed(2)}</div>
                                                                <div className="px-3 py-2 text-xs text-emerald-600 font-mono font-semibold">₹{finalRate.toFixed(2)}</div>
                                                                <div className="px-3 py-2 text-xs font-semibold text-gray-800">{fmt(e.total_amount)}</div>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="grid bg-gray-50/80 border-t border-gray-100/60"
                                                        style={{ gridTemplateColumns: "100px 80px 70px 65px 65px 65px 65px 95px" }}>
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-600 col-span-2">{entries.length} {t('sellerPayments.entries')}</div>
                                                        <div className="px-3 py-2 text-xs font-bold text-blue-700">
                                                            {entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)} L
                                                        </div>
                                                        <div className="px-3 py-2" /><div className="px-3 py-2" /><div className="px-3 py-2" /><div className="px-3 py-2" />
                                                        <div className="px-3 py-2 text-xs font-bold text-gray-900">{fmt(milkAmt)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {parseFloat(seller.walkin_deduction || 0) > 0 && (
                                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/60">
                                                <Banknote size={15} className="text-rose-400 shrink-0" />
                                                <div className="flex-1 text-xs text-rose-700">
                                                    <span className="font-semibold">{t('sellerPayments.milkBoughtBySeller')}: {fmt(seller.walkin_deduction)}</span>
                                                    <p className="text-rose-400 mt-0.5">{t('sellerPayments.deductedFromMilkPayment')}</p>
                                                </div>
                                            </div>
                                        )}

                                        {cattleFeedDed > 0 && (
                                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-50/80 border border-emerald-200/60">
                                                <Package size={15} className="text-emerald-400 shrink-0" />
                                                <div className="flex-1 text-xs text-emerald-700">
                                                    <span className="font-semibold">{t('sellerPayments.cattleFeedDeduction')}: {fmt(cattleFeedDed)}</span>
                                                    <p className="text-emerald-400 mt-0.5">{t('sellerPayments.deductedFromMilkPayment')}</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="text-xs text-gray-500 space-y-1">
                                            <p>{t('sellerPayments.milkPayable')}:
                                                <strong className="text-gray-800 ml-1">{fmt(milkAmt)}</strong>
                                            </p>
                                            {seller.seller_type === 'Gavali' && parseFloat(seller.commission_amount || 0) > 0 && (
                                                <p>{t('sellerPayments.gavaliCommissionIncluded') || 'Gavali Commission Included'}:
                                                    <strong className="text-fuchsia-600 ml-1">+ {fmt(seller.commission_amount)}</strong>
                                                    <span className="text-gray-400 ml-1 font-normal text-[10px]">({t('sellerPayments.addedToMilkRate') || 'already added to the milk rate per Fat/SNF'})</span>
                                                </p>
                                            )}
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
                                            {effectiveInstallmentCut > 0 && (
                                                <p>{t('sellerPayments.advInstallmentCut')}:
                                                    <strong className="text-rose-500 ml-1">− {fmt(effectiveInstallmentCut)}</strong>
                                                    <span className="text-gray-400 ml-1 font-normal text-[10px]">({t('sellerPayments.reducesAdvancePending')})</span>
                                                    {hasCutOverride && <span className="text-violet-500 ml-1 font-normal text-[10px]">· custom for this cycle</span>}
                                                </p>
                                            )}
                                            {!isPaid && advGiven > 0 && can('seller_payments', 'W') && (
                                                <div className="flex items-center gap-2 pt-1">
                                                    {editingCutSellerId === seller.seller_id ? (
                                                        <>
                                                            <span className="text-[10px] text-gray-400">Cut ₹</span>
                                                            <input
                                                                type="number" min={0} max={advGiven} step="0.01" autoFocus
                                                                value={customCutOverrides[seller.seller_id] ?? ""}
                                                                onChange={(e) => setCustomCutOverrides(prev => ({ ...prev, [seller.seller_id]: e.target.value }))}
                                                                placeholder={parseFloat(seller.installment_cut || 0).toFixed(2)}
                                                                className="w-24 px-2 py-1 text-xs border border-violet-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                                                            />
                                                            <button onClick={() => setEditingCutSellerId(null)}
                                                                className="text-[10px] font-semibold text-emerald-600 hover:text-emerald-700">
                                                                Done
                                                            </button>
                                                            {hasCutOverride && (
                                                                <button onClick={() => {
                                                                    setCustomCutOverrides(prev => {
                                                                        const next = { ...prev };
                                                                        delete next[seller.seller_id];
                                                                        return next;
                                                                    });
                                                                    setEditingCutSellerId(null);
                                                                }} className="text-[10px] font-semibold text-gray-400 hover:text-gray-600">
                                                                    Reset to auto
                                                                </button>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <button onClick={() => setEditingCutSellerId(seller.seller_id)}
                                                            className="flex items-center gap-1 text-[10px] font-semibold text-violet-500 hover:text-violet-700">
                                                            <Pencil size={9} />
                                                            {hasCutOverride ? "Edit custom cut" : "Customize cut for this cycle"}
                                                        </button>
                                                    )}
                                                </div>
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
                                            {cattleFeedDed > 0 && (
                                                <p>{t('sellerPayments.cattleFeedDeduction')}:
                                                    <strong className="text-emerald-600 ml-1">− {fmt(cattleFeedDed)}</strong>
                                                </p>
                                            )}
                                            {parseFloat(seller.walkin_deduction || 0) > 0 && (
                                                <p>{t('sellerPayments.milkBoughtWalkin')}:
                                                    <strong className="text-orange-500 ml-1">− {fmt(seller.walkin_deduction)}</strong>
                                                </p>
                                            )}
                                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-900 text-white mt-2 shadow-lg shadow-gray-900/20">
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
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100/60 bg-gray-50/60 backdrop-blur-sm rounded-b-2xl bg-white/80 shadow-lg shadow-gray-200/50">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm">
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
                                                    ${currentPage === p ? 'bg-gray-900 text-white border-gray-900 shadow-lg shadow-gray-900/20' : 'bg-white/50 text-gray-500 border-gray-200/60 hover:border-gray-300/80'}`}>
                                                {p}
                                            </button>
                                    )}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm">
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
                                className="w-14 border border-gray-200/60 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-black/20 transition shadow-sm"
                            />
                        </div>
                    </div>
                )}

                {/* Grand total footer */}
                {filtered.length > 0 && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-6 py-4 flex items-center justify-between">
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
                            {totalCattleFeedDeduction > 0 && (
                                <div>
                                    <p className="text-[10px] text-emerald-400 uppercase tracking-wider">{t('sellerPayments.cattleFeedDeductions')}</p>
                                    <p className="font-bold text-emerald-500">− {fmt(totalCattleFeedDeduction)}</p>
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
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-100/60 w-full max-w-6xl h-[90vh] flex flex-col">

                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100/60 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-600/20">
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

                        <div className="px-6 py-3 border-b border-gray-100/60 flex items-center gap-3 flex-wrap shrink-0 bg-gray-50/60">
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
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition shadow-sm placeholder:text-gray-300"
                                />
                                {billLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => { setBillQuery(""); searchBills(""); setBillDetail(null); }}
                                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm transition shadow-sm">
                                {t('sellerPayments.showAll')}
                            </button>
                            <span className="text-xs text-gray-400 font-medium">
                                {billResults.length > 0 ? `${billResults.length} ${billResults.length !== 1 ? t('sellerPayments.bills') : t('sellerPayments.bill')}` : ""}
                            </span>
                        </div>

                        <div className="flex flex-1 min-h-0 overflow-hidden relative">

                            <div
                                className={`flex flex-col overflow-hidden border-r border-gray-100/60 transition-all duration-300
                                    ${!billListExpanded && billDetail ? "w-0 overflow-hidden" : billDetail ? "w-2/5" : "w-full"}`}
                                onClick={() => { if (billDetail) setBillDetail(null); }}
                            >
                                <div className="grid px-4 py-2 bg-gray-50/80 border-b border-gray-100/60 text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0"
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
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-semibold hover:bg-gray-700 transition shadow-lg shadow-gray-900/20">
                                                        <Printer size={9} /> {t('sellerPayments.pdf')}
                                                    </button>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteBill(b.bill_no); }}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700 transition shadow-lg shadow-rose-600/20">
                                                        <Trash2 size={9} /> {t('sellerPayments.del')}
                                                    </button>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {billDetail && (
                                <div className="flex-1 overflow-y-auto flex flex-col relative bg-white/95">
                                    <button
                                        onClick={() => setBillListExpanded(p => !p)}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center
                                            w-5 h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-r-lg shadow-lg shadow-violet-600/20 transition"
                                        title={billListExpanded ? t('sellerPayments.hideList') : t('sellerPayments.showList')}>
                                        {billListExpanded ? <ChevronDown size={11} className="-rotate-90" /> : <ChevronDown size={11} className="rotate-90" />}
                                    </button>

                                    {billDetailLoading ? (
                                        <div className="flex items-center justify-center flex-1">
                                            <div className="w-5 h-5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-6 py-4 border-b border-gray-100/60 flex items-center justify-between shrink-0 bg-violet-50/80">
                                                <button
                                                    onClick={() => setBillDetail(null)}
                                                    className="absolute right-4 top-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 border border-gray-200/60 transition shadow-sm">
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
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition shadow-lg shadow-gray-900/20">
                                                    <Printer size={13} /> {t('sellerPayments.printFullPDF')}
                                                </button>
                                            </div>

                                            <div className="px-6 py-4 flex flex-col gap-5">

                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {[
                                                        { label: t('sellerPayments.milkAmount'), value: `₹${parseFloat(billDetail.payment.milk_amount || 0).toFixed(2)}`, color: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700" },
                                                        { label: t('sellerPayments.totalEntries'), value: `${billDetail.entries.length} ${t('sellerPayments.entries')}`, color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700" },
                                                        { label: t('sellerPayments.totalQty'), value: `${billDetail.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L`, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                                                        { label: t('sellerPayments.netCashPaid'), value: `₹${Math.max(0, parseFloat(billDetail.payment.cash_paid || 0)).toFixed(2)}`, color: "from-gray-900 to-gray-800 border-gray-800/60 text-white" },
                                                    ].map(({ label, value, color }) => (
                                                        <div key={label} className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${color} shadow-sm px-4 py-3`}>
                                                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                                            <p className="text-sm font-bold mt-0.5 text-gray-900">{value}</p>
                                                            <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full bg-white/20 blur-2xl" />
                                                        </div>
                                                    ))}
                                                </div>

                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                        {t('sellerPayments.milkCollectionEntries')} ({billDetail.entries.length})
                                                    </p>
                                                    <div className="rounded-xl border border-gray-100/60 overflow-hidden text-xs">
                                                        <div className="grid bg-gray-900 text-white"
                                                            style={{ gridTemplateColumns: "85px 65px 60px 55px 55px 55px 60px 70px" }}>
                                                            {[t('sellerPayments.date'), t('sellerPayments.shift'), t('sellerPayments.type'), t('sellerPayments.qtyL'), t('sellerPayments.fat'), t('sellerPayments.snf'), t('sellerPayments.rateBeforeComm'), t('sellerPayments.rateAfterComm'), t('sellerPayments.amount')].map(h => (
                                                                <div key={h} className="px-3 py-2 text-[10px] font-semibold uppercase">{h}</div>
                                                            ))}
                                                        </div>
                                                        {billDetail.entries.map((e, i) => {
                                                            const baseRate = parseFloat(e.base_rate || e.rate_applied || 0);
                                                            const finalRate = parseFloat(e.rate_applied || 0);
                                                            return (
                                                                <div key={i}
                                                                    className={`grid border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
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
                                                                    <div className="px-3 py-2 text-gray-500 font-mono">₹{baseRate.toFixed(2)}</div>
                                                                    <div className="px-3 py-2 text-emerald-600 font-mono font-semibold">₹{finalRate.toFixed(2)}</div>
                                                                    <div className="px-3 py-2 font-bold text-gray-800">₹{parseFloat(e.total_amount || 0).toFixed(2)}</div>
                                                                </div>
                                                            );
                                                        })}
                                                        <div className="grid bg-gray-100/80 border-t-2 border-gray-200 font-bold"
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

                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">{t('sellerPayments.paymentBreakdown')}</p>
                                                    <div className="rounded-xl border border-gray-100/60 overflow-hidden">
                                                        {[
                                                            {
                                                                label: t('sellerPayments.milkAmountPayable'),
                                                                value: parseFloat(billDetail.payment.milk_amount || 0),
                                                                type: "credit",
                                                                color: "bg-emerald-50/80 text-emerald-700",
                                                                always: true,
                                                            },
                                                            {
                                                                label: t('sellerPayments.advancePendingOutstanding'),
                                                                value: parseFloat(billDetail.payment.advance_given || 0),
                                                                type: "info",
                                                                color: "bg-violet-50/80 text-violet-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.installmentCut'),
                                                                value: parseFloat(billDetail.payment.installment_cut || 0),
                                                                type: "debit",
                                                                color: "bg-rose-50/80 text-rose-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.depositDeductedPerLitre'),
                                                                value: parseFloat(billDetail.payment.deposit_amount || 0),
                                                                type: "debit",
                                                                color: "bg-blue-50/80 text-blue-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.productSalesDeduction'),
                                                                value: parseFloat(billDetail.payment.product_deduction || 0),
                                                                type: "debit",
                                                                color: "bg-amber-50/80 text-amber-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.cattleFeedDeduction'),
                                                                value: parseFloat(billDetail.payment.cattle_feed_deduction || 0),
                                                                type: "debit",
                                                                color: "bg-emerald-50/80 text-emerald-700",
                                                                always: false,
                                                            },
                                                            {
                                                                label: t('sellerPayments.milkBoughtBySellerWalkinShort'),
                                                                value: parseFloat(billDetail.payment.walkin_deduction || 0),
                                                                type: "debit",
                                                                color: "bg-orange-50/80 text-orange-700",
                                                                always: false,
                                                            },
                                                        ].filter(row => row.always || row.value > 0).map((row, i) => (
                                                            <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100/60 last:border-0 ${row.color}`}>
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
                                                        <div className="flex items-center justify-between px-4 py-4 bg-gray-900 text-white shadow-lg shadow-gray-900/20">
                                                            <span className="text-sm font-bold uppercase tracking-wider">{t('sellerPayments.netCashToHand')}</span>
                                                            <span className="text-lg font-bold font-mono">
                                                                ₹{Math.max(0, parseFloat(billDetail.payment.final_payable || billDetail.payment.cash_paid || 0)).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {billDetail.advances?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.advanceTransactions')} ({billDetail.advances.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100/60 overflow-hidden">
                                                            {billDetail.advances.map((a, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100/60 last:border-0 ${i % 2 === 0 ? "bg-white/50" : "bg-gray-50/40"}`}>
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

                                                {billDetail.productSales?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.productSales')} ({billDetail.productSales.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100/60 overflow-hidden">
                                                            {billDetail.productSales.map((s, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100/60 last:border-0 ${i % 2 === 0 ? "bg-white/50" : "bg-amber-50/30"}`}>
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

                                                {billDetail.cattleFeedSales?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.cattleFeedSales')} ({billDetail.cattleFeedSales.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100/60 overflow-hidden">
                                                            {billDetail.cattleFeedSales.map((f, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100/60 last:border-0 ${i % 2 === 0 ? "bg-white/50" : "bg-emerald-50/30"}`}>
                                                                    <div>
                                                                        <p className="text-xs font-medium text-gray-700">{f.feed_name}</p>
                                                                        <p className="text-[10px] text-gray-400 mt-0.5">
                                                                            {parseFloat(f.quantity || 0).toFixed(2)} units
                                                                            {" · "}
                                                                            {new Date(f.sale_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                        </p>
                                                                    </div>
                                                                    <span className="text-xs font-bold font-mono text-emerald-700">
                                                                        − ₹{parseFloat(f.total_amount || 0).toFixed(2)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {billDetail.walkinSales?.length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            {t('sellerPayments.walkinSales')} ({billDetail.walkinSales.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100/60 overflow-hidden">
                                                            {billDetail.walkinSales.map((w, i) => (
                                                                <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100/60 last:border-0 ${i % 2 === 0 ? "bg-white/50" : "bg-orange-50/30"}`}>
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

                                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100/60">
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
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
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
                            <div className="rounded-xl bg-rose-50/80 border border-rose-200/60 px-4 py-3 text-xs text-rose-700 flex flex-col gap-1">
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
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                                {t('sellerPayments.cancel')}
                            </button>
                            <button
                                onClick={confirmDeleteBill}
                                disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50 shadow-lg shadow-rose-600/20">
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