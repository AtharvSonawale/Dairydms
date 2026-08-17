// src/pages/farmer/FarmerDashboard.jsx
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import {
    Milk, Wallet, TrendingUp, TrendingDown, Banknote,
    FlaskConical, Sun, Moon, AlertTriangle, Receipt,
    Calendar, PiggyBank, User, Phone, CreditCard, MapPin,
    Landmark, Building2, BadgeCheck, ShoppingBag, Hash, X,
    Droplets, Home, Scale
} from "lucide-react";
import { Link } from "react-router-dom";

// ── helpers (mirrors AdminDashboard) ─────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

const pad2 = (n) => String(n).padStart(2, "0");

// Fixed monthly payment cycles: 1–10, 11–20, 21–end of month (mirrors SellerPayments.jsx)
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

// Returns the fixed cycle (of the 3) that contains the given reference date
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

const fmtCycleRange = (from, to) => `${fmtDate(from)} – ${fmtDate(to)}`;

// Optional custom period filtering (day/week/month/year) — secondary to payment-cycle view
const getDateRange = (dateStr, period) => {
    const date = new Date(dateStr);
    let from, to;
    switch (period) {
        case 'day':
            from = to = dateStr;
            break;
        case 'week': {
            const dayOfWeek = date.getDay();
            const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
            const monday = new Date(date);
            monday.setDate(diff);
            from = monday.toISOString().split('T')[0];
            const sunday = new Date(monday);
            sunday.setDate(diff + 6);
            to = sunday.toISOString().split('T')[0];
            break;
        }
        case 'month':
            from = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
            to = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
            break;
        case 'year':
            from = `${date.getFullYear()}-01-01`;
            to = `${date.getFullYear()}-12-31`;
            break;
        default:
            from = to = dateStr;
    }
    return { from, to };
};

const formatPeriodLabel = (period, from, to) => {
    if (period === 'day') return new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (period === 'week') {
        const fromDate = new Date(from), toDate = new Date(to);
        return `${fromDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${toDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    if (period === 'month') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (period === 'year') return new Date(from).getFullYear();
    return '';
};

// ── sub-components (same visual system as AdminDashboard) ────
function StatCard({ label, value, sub, icon, color }) {
    const colorMap = {
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        red: "from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700",
        slate: "from-slate-50 to-slate-100/50 border-slate-200/60 text-slate-700",
        indigo: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700",
        teal: "from-teal-50 to-teal-100/50 border-teal-200/60 text-teal-700",
        gray: "from-gray-50 to-gray-100/50 border-gray-200/60 text-gray-700",
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color] || colorMap.gray} shadow-sm p-4 flex items-center gap-3`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">{icon}</div>
            <div className="relative z-10 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-1">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function SectionHeader({ icon, title, sub, action }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
                    {sub && <p className="text-xs text-gray-500 leading-tight">{sub}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function ShiftBadge({ shift, t }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm
            ${shift === "morning"
                ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                : "bg-indigo-50/80 text-indigo-600 border-indigo-200/60"}`}>
            {shift === "morning" ? <Sun size={10} /> : <Moon size={10} />}
            {shift === "morning" ? t('bill.morning') : t('bill.evening')}
        </span>
    );
}

function MilkTypeBadge({ type, t }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm
            ${type === "cow"
                ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                : "bg-slate-100/80 text-slate-700 border-slate-200/60"}`}>
            {type === "cow" ? t('dashboard.cow') : t('dashboard.buffalo')}
        </span>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-gray-400">
            <div className="p-4 rounded-full bg-gray-100/50">{icon}</div>
            <p className="text-sm font-medium">{text}</p>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );
}

function Paginator({ total, page, setPage, pageSize }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (total === 0) return null;
    return (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-100/60">
            <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm"
            >
                ← Prev
            </button>
            <span className="text-xs text-gray-400">
                Page {page} of {totalPages} · {total} records
            </span>
            <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm"
            >
                Next →
            </button>
        </div>
    );
}

// ── Main Farmer Dashboard ─────────────────────────────────────
export default function FarmerDashboard() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return { text: t('dashboard.greetMorning'), icon: <Sun size={16} className="text-amber-500" /> };
        if (h < 17) return { text: t('dashboard.greetAfternoon'), icon: <Sun size={16} className="text-orange-400" /> };
        return { text: t('dashboard.greetEvening'), icon: <Moon size={16} className="text-indigo-400" /> };
    };
    const greeting = getGreeting();

    const [selectedDate, setSelectedDate] = useState(today());
    const [flash, setFlash] = useState(null);

    // Payment Cycle is the priority/default view; Custom Period (day/week/month/year) is optional
    const [viewMode, setViewMode] = useState('cycle'); // 'cycle' | 'period'
    const [period, setPeriod] = useState('week');

    // Current payment cycle (fixed monthly: 1–10 / 11–20 / 21–end), same convention as SellerPayments.jsx
    const activeCycle = getActiveFixedCycle(new Date(selectedDate + 'T00:00:00'));
    const customRange = getDateRange(selectedDate, period);
    const { from: rangeFrom, to: rangeTo } = viewMode === 'cycle' ? activeCycle : customRange;

    const [profile, setProfile] = useState(null);
    const [milkEntries, setMilkEntries] = useState([]);
    const [bills, setBills] = useState([]);
    const [advances, setAdvances] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [premiumRates, setPremiumRates] = useState([]);
    const [productSales, setProductSales] = useState([]);
    const [balances, setBalances] = useState({ advance_balance: 0, deposit_balance: 0 });

    const [load, setLoad] = useState({ milk: true, bills: true, advance: true, deposit: true });

    const PAGE_SIZE = 6;
    const [milkPage, setMilkPage] = useState(1);
    const [billPage, setBillPage] = useState(1);
    const [advPage, setAdvPage] = useState(1);
    const [depPage, setDepPage] = useState(1);
    const [premPage, setPremPage] = useState(1);
    const [prodPage, setProdPage] = useState(1);

    const [billModalOpen, setBillModalOpen] = useState(false);
    const [billDetail, setBillDetail] = useState(null);
    const [billDetailLoading, setBillDetailLoading] = useState(false);

    const openBillDetail = async (bill_no) => {
        setBillModalOpen(true);
        setBillDetail(null);
        setBillDetailLoading(true);
        try {
            const { data } = await api.get(`/farmer/bill/${bill_no}`);
            setBillDetail(data);
        } catch {
            showFlash("error", t('farmerDashboard.billLoadFailed'));
            setBillModalOpen(false);
        } finally {
            setBillDetailLoading(false);
        }
    };

    const closeBillDetail = () => {
        setBillModalOpen(false);
        setBillDetail(null);
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // Expected shape from GET /api/farmer/dashboard?from&to (own-seller-only)
    const fetchAll = useCallback(async (fromDate, toDate) => {
        try {
            const { data } = await api.get(`/farmer/dashboard?from=${fromDate}&to=${toDate}`);
            setProfile(data.profile || null);
            setMilkEntries(data.milk_entries || []);
            setBills(data.bills || []);
            setAdvances(data.advances || []);
            setDeposits(data.deposits || []);
            setPremiumRates(data.premium_rates || []);
            setProductSales(data.product_sales || []);
            setBalances(data.balances || { advance_balance: 0, deposit_balance: 0 });
        } catch {
            showFlash("error", t('farmerDashboard.loadFailed'));
        } finally {
            setLoad({ milk: false, bills: false, advance: false, deposit: false });
        }
    }, [t]);

    useEffect(() => {
        fetchAll(rangeFrom, rangeTo);
    }, [selectedDate, viewMode, period, fetchAll, rangeFrom, rangeTo]);

    useEffect(() => {
        setMilkPage(1); setBillPage(1); setAdvPage(1);
        setDepPage(1); setPremPage(1); setProdPage(1);
    }, [selectedDate, viewMode, period]);

    const totalMilkQty = milkEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalMilkAmt = milkEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const avgFat = milkEntries.length ? milkEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / milkEntries.length : 0;
    const avgSnf = milkEntries.length ? milkEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / milkEntries.length : 0;

    const morningEntries = milkEntries.filter((e) => e.shift === "morning");
    const eveningEntries = milkEntries.filter((e) => e.shift === "evening");
    const cowEntries = milkEntries.filter((e) => e.milk_type === "cow");
    const bufEntries = milkEntries.filter((e) => e.milk_type === "buffalo");

    const advGiven = advances.filter((a) => a.type === "given").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const advReceived = advances.filter((a) => a.type === "received").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const depCredit = deposits.filter((d) => d.type === "credit").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const depDebit = deposits.filter((d) => d.type === "debit").reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    const pagedMilk = milkEntries.slice((milkPage - 1) * PAGE_SIZE, milkPage * PAGE_SIZE);
    const pagedBills = bills.slice((billPage - 1) * PAGE_SIZE, billPage * PAGE_SIZE);
    const pagedAdvances = advances.slice((advPage - 1) * PAGE_SIZE, advPage * PAGE_SIZE);
    const pagedDeposits = deposits.slice((depPage - 1) * PAGE_SIZE, depPage * PAGE_SIZE);
    const pagedPremium = premiumRates.slice((premPage - 1) * PAGE_SIZE, premPage * PAGE_SIZE);
    const pagedProducts = productSales.slice((prodPage - 1) * PAGE_SIZE, prodPage * PAGE_SIZE);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('farmerDashboard.myDashboard')}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/30">
                                <User size={12} /> {t('farmerDashboard.farmerLabel')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {greeting.text}, {user?.name || t('farmerDashboard.farmerLabel')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerDashboard.referenceDate')}</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-40"
                            />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerDashboard.viewLabel')}</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-bold bg-white/50 backdrop-blur-sm shadow-sm">
                                <button
                                    onClick={() => setViewMode('cycle')}
                                    className={`px-3.5 py-2 transition-all duration-200 ${viewMode === 'cycle' ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}
                                >
                                    {t('farmerDashboard.paymentCycle')}
                                </button>
                                <button
                                    onClick={() => setViewMode('period')}
                                    className={`px-3.5 py-2 transition-all duration-200 ${viewMode === 'period' ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}
                                >
                                    {t('farmerDashboard.customPeriod')}
                                </button>
                            </div>
                        </div>

                        {viewMode === 'period' && (
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{t('farmerDashboard.periodLabel')}</span>
                                <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-bold bg-white/50 backdrop-blur-sm shadow-sm">
                                    {['day', 'week', 'month', 'year'].map((p) => (
                                        <button
                                            key={p}
                                            onClick={() => setPeriod(p)}
                                            className={`px-3.5 py-2 transition-all duration-200 ${period === p ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}
                                        >
                                            {t(`dashboard.${p}`)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Current Payment Cycle / Custom Period indicator ── */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-emerald-50/80 backdrop-blur-sm shadow-lg shadow-emerald-200/50 px-5 py-4">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-400/5 blur-3xl" />
                    <div className="flex items-center justify-between relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                                <Calendar size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                    {viewMode === 'cycle'
                                        ? t('farmerDashboard.currentPaymentCycle')
                                        : t('farmerDashboard.customPeriodViewing')}
                                </p>
                                <p className="text-sm font-bold text-gray-900 leading-tight">
                                    {viewMode === 'cycle'
                                        ? <>{activeCycle.label} <span className="font-normal text-gray-400">·</span> {fmtDate(rangeFrom)} – {fmtDate(rangeTo)}</>
                                        : <>{formatPeriodLabel(period, rangeFrom, rangeTo)}</>}
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-medium text-emerald-500 bg-white/50 px-3 py-1 rounded-full border border-emerald-200/60 backdrop-blur-sm">
                            {viewMode === 'cycle'
                                ? t('farmerDashboard.cycleNote')
                                : t('farmerDashboard.periodNote')}
                        </span>
                    </div>
                </div>

                {/* ── Flash message ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold backdrop-blur-sm shadow-sm
                        ${flash.type === "success" ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700" : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={18} />}
                        {flash.type === "success" && <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Shift Priority Banner ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-amber-50/80 backdrop-blur-sm shadow-lg shadow-amber-200/50 px-5 py-4">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/5 blur-3xl" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                                    <Sun size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{t('dashboard.morningShift')}</p>
                                    <p className="text-2xl font-bold text-amber-800 leading-tight">
                                        {morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                        <span className="text-sm font-medium text-amber-500 ml-1">L</span>
                                    </p>
                                    <p className="text-[10px] text-amber-500 mt-0.5">{morningEntries.length} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-amber-400 uppercase tracking-wider">{t('bill.amount')}</p>
                                <p className="text-base font-bold text-amber-700">
                                    ₹{fmt(morningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-indigo-50/80 backdrop-blur-sm shadow-lg shadow-indigo-200/50 px-5 py-4">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/5 blur-3xl" />
                        <div className="flex items-center justify-between relative z-10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                                    <Moon size={18} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">{t('dashboard.eveningShift')}</p>
                                    <p className="text-2xl font-bold text-indigo-800 leading-tight">
                                        {eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)}
                                        <span className="text-sm font-medium text-indigo-400 ml-1">L</span>
                                    </p>
                                    <p className="text-[10px] text-indigo-400 mt-0.5">{eveningEntries.length} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-indigo-400 uppercase tracking-wider">{t('bill.amount')}</p>
                                <p className="text-base font-bold text-indigo-700">
                                    ₹{fmt(eveningEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0))}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Earnings + Balances Overview ── */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Droplets size={14} /> {t('farmerDashboard.myOverview')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard
                            label={t('farmerDashboard.milkDelivered')}
                            value={totalMilkQty.toFixed(1) + " L"}
                            sub={`${milkEntries.length} ${t('dashboard.entries')}`}
                            icon={<Milk size={16} />}
                            color="amber"
                        />
                        <StatCard
                            label={t('farmerDashboard.milkEarnings')}
                            value={"₹" + fmt(totalMilkAmt)}
                            sub={viewMode === 'cycle' ? fmtCycleRange(rangeFrom, rangeTo) : formatPeriodLabel(period, rangeFrom, rangeTo)}
                            icon={<Banknote size={16} />}
                            color="emerald"
                        />
                        <StatCard
                            label={t('farmerDashboard.advanceBalance')}
                            value={"₹" + fmt(balances.advance_balance)}
                            sub={t('farmerDashboard.outstanding')}
                            icon={<Wallet size={16} />}
                            color={balances.advance_balance > 0 ? "red" : "slate"}
                        />
                        <StatCard
                            label={t('farmerDashboard.depositBalance')}
                            value={"₹" + fmt(balances.deposit_balance)}
                            sub={t('farmerDashboard.heldByDairy')}
                            icon={<PiggyBank size={16} />}
                            color="violet"
                        />
                    </div>
                </div>

                {/* ── Milk Quality & Breakdown ── */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <FlaskConical size={14} /> {t('dashboard.milkCollection')}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-indigo-50/80 backdrop-blur-sm shadow-lg shadow-indigo-200/50 p-4 col-span-2 sm:col-span-1">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/5 blur-3xl" />
                            <div className="flex items-center justify-between relative z-10">
                                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{t('dashboard.avgFatSnf')}</p>
                                <FlaskConical size={15} className="opacity-70 text-indigo-600" />
                            </div>
                            <p className="text-lg font-bold text-gray-900 mt-1">{avgFat.toFixed(2)} / {avgSnf.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{t('farmerDashboard.acrossAllEntries')}</p>
                        </div>

                        {[
                            { label: t('bill.morning'), qty: morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: morningEntries.length, icon: <Sun size={14} className="text-amber-600" />, color: "from-amber-50 to-amber-100/50 border-amber-200/60" },
                            { label: t('bill.evening'), qty: eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: eveningEntries.length, icon: <Moon size={14} className="text-indigo-600" />, color: "from-indigo-50 to-indigo-100/50 border-indigo-200/60" },
                            { label: t('dashboard.cow'), qty: cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: cowEntries.length, icon: <Milk size={14} className="text-amber-600" />, color: "from-amber-50 to-amber-100/50 border-amber-200/60" },
                            { label: t('dashboard.buffalo'), qty: bufEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: bufEntries.length, icon: <Milk size={14} className="text-slate-600" />, color: "from-slate-50 to-slate-100/50 border-slate-200/60" },
                        ].map(({ label, qty, count, icon, color }) => (
                            <div key={label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
                                <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
                                <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">{icon}</div>
                                <div className="relative z-10">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                                    <p className="text-lg font-bold text-gray-900 leading-tight mt-1">{qty.toFixed(1)} L</p>
                                    <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{count} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Recent Milk Entries ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        <SectionHeader
                            icon={<Milk size={16} className="text-white" />}
                            title={t('farmerDashboard.myMilkEntries')}
                            sub={`${milkEntries.length} ${t('dashboard.total')} · ${viewMode === 'cycle' ? fmtCycleRange(rangeFrom, rangeTo) : formatPeriodLabel(period, rangeFrom, rangeTo)}`}
                            action={
                                <Link to="/farmer/milk-entries" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                    {t('farmerDashboard.viewAll')} →
                                </Link>
                            }
                        />
                        {load.milk ? <Spinner /> : pagedMilk.length === 0 ? (
                            <EmptyState icon={<Milk size={32} />} text={t('farmerDashboard.noMilkEntries')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {pagedMilk.map((e) => (
                                    <div key={e.entry_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                                                <Milk size={14} className="text-white" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-800">{fmtDate(e.entry_date)}</p>
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    <ShiftBadge shift={e.shift} t={t} />
                                                    <MilkTypeBadge type={e.milk_type} t={t} />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-xs font-bold text-blue-600">{parseFloat(e.quantity).toFixed(1)} L</p>
                                            <p className="text-[10px] text-gray-400">{t('bill.fat')} {parseFloat(e.fat).toFixed(1)} · {t('bill.snf')} {parseFloat(e.snf).toFixed(1)}</p>
                                            <p className="text-[10px] text-emerald-600 font-semibold">₹{fmt(e.total_amount)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Paginator total={milkEntries.length} page={milkPage} setPage={setMilkPage} pageSize={PAGE_SIZE} />
                    </div>
                </div>

                {/* ── My Bills ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        <SectionHeader
                            icon={<Receipt size={16} className="text-white" />}
                            title={t('farmerDashboard.myBills')}
                            sub={`${bills.length} ${t('dashboard.total')}`}
                            action={
                                <Link to="/farmer/bills" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">
                                    {t('farmerDashboard.viewAll')} →
                                </Link>
                            }
                        />
                        {load.bills ? <Spinner /> : pagedBills.length === 0 ? (
                            <EmptyState icon={<Receipt size={32} />} text={t('farmerDashboard.noBills')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {pagedBills.map((b) => (
                                    <div key={b.bill_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                        <div className="min-w-0">
                                            <button
                                                onClick={() => openBillDetail(b.bill_no)}
                                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition"
                                            >
                                                {b.bill_no}
                                            </button>
                                            <p className="text-[10px] text-gray-400">
                                                {fmtDate(b.from_date)} – {fmtDate(b.to_date)}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-xs font-bold text-emerald-600">₹{fmt(b.final_payable)}</p>
                                            <p className="text-[10px] text-gray-400">{b.total_qty} L · {b.total_entries} {t('dashboard.entries')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Paginator total={bills.length} page={billPage} setPage={setBillPage} pageSize={PAGE_SIZE} />
                    </div>
                </div>

                {/* ── Advance & Deposit History ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<Wallet size={16} className="text-white" />}
                                title={t('dashboard.cashAdvance')}
                                sub={`${advances.length} ${t('dashboard.transactions')}`}
                            />
                            {load.advance ? <Spinner /> : pagedAdvances.length === 0 ? (
                                <EmptyState icon={<Wallet size={32} />} text={t('farmerDashboard.noAdvances')} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {pagedAdvances.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${a.type === "given" ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30" : "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30"}`}>
                                                    {a.type === "given" ? <TrendingUp size={14} className="text-white" /> : <TrendingDown size={14} className="text-white" />}
                                                </div>
                                                <p className="text-[10px] text-gray-500 truncate">{a.remarks || (a.type === "given" ? t('dashboard.advanceGiven') : t('dashboard.installmentReceived'))}</p>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className={`text-xs font-bold ${a.type === "given" ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {a.type === "given" ? "+" : "−"}₹{fmt(a.amount)}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{fmtDate(a.transaction_date)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Paginator total={advances.length} page={advPage} setPage={setAdvPage} pageSize={PAGE_SIZE} />
                            <div className="mt-3 pt-3 border-t border-gray-100/60 flex justify-between text-xs text-gray-500">
                                <span>{t('farmerDashboard.givenLabel')}: <strong className="text-emerald-600">₹{fmt(advGiven)}</strong></span>
                                <span>{t('farmerDashboard.receivedLabel')}: <strong className="text-rose-600">₹{fmt(advReceived)}</strong></span>
                            </div>
                        </div>
                    </div>

                    <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                        <div className="relative z-10">
                            <SectionHeader
                                icon={<PiggyBank size={16} className="text-white" />}
                                title={t('farmerDashboard.depositLabel')}
                                sub={`${deposits.length} ${t('dashboard.transactions')}`}
                            />
                            {load.deposit ? <Spinner /> : pagedDeposits.length === 0 ? (
                                <EmptyState icon={<PiggyBank size={32} />} text={t('farmerDashboard.noDeposits')} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-100/60">
                                    {pagedDeposits.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${d.type === "credit" ? "bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/30" : "bg-gradient-to-br from-gray-500 to-gray-600 shadow-gray-500/30"}`}>
                                                    {d.type === "credit" ? <TrendingUp size={14} className="text-white" /> : <TrendingDown size={14} className="text-white" />}
                                                </div>
                                                <p className="text-[10px] text-gray-500 truncate">{d.remarks || (d.type === "credit" ? t('farmerDashboard.depositAdded') : t('farmerDashboard.depositWithdrawn'))}</p>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className={`text-xs font-bold ${d.type === "credit" ? "text-violet-600" : "text-gray-600"}`}>
                                                    {d.type === "credit" ? "+" : "−"}₹{fmt(d.amount)}
                                                </p>
                                                <p className="text-[10px] text-gray-400">{fmtDate(d.transaction_date)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Paginator total={deposits.length} page={depPage} setPage={setDepPage} pageSize={PAGE_SIZE} />
                            <div className="mt-3 pt-3 border-t border-gray-100/60 flex justify-between text-xs text-gray-500">
                                <span>{t('farmerDashboard.addedLabel')}: <strong className="text-violet-600">₹{fmt(depCredit)}</strong></span>
                                <span>{t('farmerDashboard.withdrawnLabel')}: <strong className="text-gray-600">₹{fmt(depDebit)}</strong></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── My Premium Rates ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        <SectionHeader
                            icon={<FlaskConical size={16} className="text-white" />}
                            title={t('farmerDashboard.myPremiumRates')}
                            sub={`${premiumRates.length} ${t('dashboard.total')}`}
                        />
                        {pagedPremium.length === 0 ? (
                            <EmptyState icon={<FlaskConical size={32} />} text={t('farmerDashboard.noPremiumRates')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {pagedPremium.map((r) => (
                                    <div key={r.id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <MilkTypeBadge type={r.milk_type} t={t} />
                                            <p className="text-[10px] text-gray-500 truncate">{r.reason || "—"}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-xs font-bold text-gray-800">₹{fmt(r.rate_per_liter)} /L</p>
                                            <p className="text-[10px] text-gray-400">{fmtDate(r.effective_from)} – {r.effective_to ? fmtDate(r.effective_to) : t('farmerDashboard.ongoing')}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Paginator total={premiumRates.length} page={premPage} setPage={setPremPage} pageSize={PAGE_SIZE} />
                    </div>
                </div>

                {/* ── My Product Purchases ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        <SectionHeader
                            icon={<ShoppingBag size={16} className="text-white" />}
                            title={t('farmerDashboard.myProductPurchases')}
                            sub={`${productSales.length} ${t('dashboard.total')} · ${viewMode === 'cycle' ? fmtCycleRange(rangeFrom, rangeTo) : formatPeriodLabel(period, rangeFrom, rangeTo)}`}
                        />
                        {pagedProducts.length === 0 ? (
                            <EmptyState icon={<ShoppingBag size={32} />} text={t('farmerDashboard.noProductPurchases')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {pagedProducts.map((p) => (
                                    <div key={p.sale_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800">{p.product_name}</p>
                                            <p className="text-[10px] text-gray-400">{fmtDate(p.sale_date)} · {p.quantity} {p.unit || ""}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className="text-xs font-bold text-gray-800">₹{fmt(p.total_amount)}</p>
                                            <p className="text-[10px] text-gray-400">@₹{fmt(p.rate)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Paginator total={productSales.length} page={prodPage} setPage={setProdPage} pageSize={PAGE_SIZE} />
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-600">{viewMode === 'cycle' ? activeCycle.label : period}</strong> {t('dashboard.footerData')}: {fmtDate(rangeFrom)} – {fmtDate(rangeTo)}</span>
                    <span>· {t('farmerDashboard.farmerFooter')}</span>
                </div>

            </main>

            {/* ── Bill Detail Modal ── */}
            {billModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-3xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-emerald-50/50 to-white/50 rounded-t-2xl">
                            <div>
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                                        <Receipt size={16} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-mono font-bold text-emerald-700">{billDetail?.payment?.bill_no}</span>
                                            {billDetail?.payment?.paid_at && (
                                                <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-100/80 text-emerald-700 font-semibold border border-emerald-200/60 backdrop-blur-sm">
                                                    {t('dashboard.paid')}
                                                </span>
                                            )}
                                        </div>
                                        {billDetail?.payment && (
                                            <p className="text-[11px] text-gray-500 mt-0.5">
                                                {fmtDate(billDetail.payment.from_date)} → {fmtDate(billDetail.payment.to_date)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={closeBillDetail}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            {billDetailLoading ? (
                                <Spinner />
                            ) : !billDetail ? (
                                <EmptyState icon={<Receipt size={32} />} text={t('farmerDashboard.billLoadFailed')} />
                            ) : (
                                <div className="flex flex-col gap-5">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <StatCard
                                            label={t('farmerDashboard.milkAmount')}
                                            value={`₹${fmt(billDetail.payment.milk_amount)}`}
                                            icon={<Milk size={14} />}
                                            color="emerald"
                                        />
                                        <StatCard
                                            label={t('dashboard.total') + ' ' + t('dashboard.entries')}
                                            value={billDetail.entries.length}
                                            icon={<Receipt size={14} />}
                                            color="blue"
                                        />
                                        <StatCard
                                            label={t('farmerDashboard.totalQty')}
                                            value={`${billDetail.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L`}
                                            icon={<FlaskConical size={14} />}
                                            color="amber"
                                        />
                                        <StatCard
                                            label={t('farmerDashboard.netCashPaid')}
                                            value={`₹${fmt(billDetail.payment.cash_paid)}`}
                                            icon={<Banknote size={14} />}
                                            color="violet"
                                        />
                                    </div>

                                    {/* Milk entries table */}
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Milk size={12} /> {t('farmerDashboard.milkCollectionEntries')} ({billDetail.entries.length})
                                        </p>
                                        <div className="rounded-xl border border-gray-200/60 overflow-x-auto shadow-sm">
                                            <table className="w-full text-xs min-w-max">
                                                <thead className="bg-gradient-to-r from-gray-50/50 to-white/50">
                                                    <tr>
                                                        {[t('bill.date'), t('bill.shift'), t('farmerDashboard.milkType'), t('farmerDashboard.qty'), t('bill.fat'), t('bill.snf'), t('bill.rate'), t('bill.amount')].map(h => (
                                                            <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-200/60 last:border-r-0">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100/60">
                                                    {billDetail.entries.map((e, i) => (
                                                        <tr key={i} className="hover:bg-gray-50/30 transition">
                                                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap border-r border-gray-200/60">{fmtDate(e.entry_date)}</td>
                                                            <td className="px-3 py-2.5 border-r border-gray-200/60"><ShiftBadge shift={e.shift} t={t} /></td>
                                                            <td className="px-3 py-2.5 border-r border-gray-200/60"><MilkTypeBadge type={e.milk_type} t={t} /></td>
                                                            <td className="px-3 py-2.5 font-mono text-blue-600 font-semibold border-r border-gray-200/60">{parseFloat(e.quantity || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2.5 font-mono text-amber-600 border-r border-gray-200/60">{parseFloat(e.fat || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2.5 font-mono text-violet-600 border-r border-gray-200/60">{parseFloat(e.snf || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2.5 font-mono text-gray-600 border-r border-gray-200/60">₹{parseFloat(e.rate_applied || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2.5 font-bold text-gray-800">₹{parseFloat(e.total_amount || 0).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Payment breakdown */}
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Banknote size={12} /> {t('farmerDashboard.paymentBreakdown')}
                                        </p>
                                        <div className="rounded-xl border border-gray-200/60 overflow-hidden shadow-sm">
                                            {[
                                                { label: t('farmerDashboard.milkAmountPayable'), value: billDetail.payment.milk_amount, sign: "+", color: "bg-emerald-50/80 text-emerald-700" },
                                                { label: t('farmerDashboard.advanceOutstanding'), value: billDetail.payment.advance_given, sign: "", color: "bg-violet-50/80 text-violet-700", skipIfZero: true },
                                                { label: t('farmerDashboard.advInstallmentCut'), value: billDetail.payment.installment_cut, sign: "−", color: "bg-rose-50/80 text-rose-700", skipIfZero: true },
                                                { label: t('farmerDashboard.depositDeducted'), value: billDetail.payment.deposit_amount, sign: "−", color: "bg-blue-50/80 text-blue-700", skipIfZero: true },
                                                { label: t('farmerDashboard.productSalesDeduction'), value: billDetail.payment.product_deduction, sign: "−", color: "bg-amber-50/80 text-amber-700", skipIfZero: true },
                                                { label: t('farmerDashboard.milkBoughtDeduction'), value: billDetail.payment.walkin_deduction, sign: "−", color: "bg-orange-50/80 text-orange-700", skipIfZero: true },
                                            ].filter(row => !row.skipIfZero || parseFloat(row.value || 0) > 0).map((row, i) => (
                                                <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-200/60 last:border-0 ${row.color} backdrop-blur-sm`}>
                                                    <span className="text-xs font-medium">{row.label}</span>
                                                    <span className="text-xs font-bold font-mono">{row.sign} ₹{fmt(row.value)}</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                                                <span className="text-xs font-bold uppercase tracking-wider">{t('farmerDashboard.netCashToHand')}</span>
                                                <span className="text-base font-bold font-mono">₹{fmt(billDetail.payment.final_payable ?? billDetail.payment.cash_paid)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advances in this cycle */}
                                    {billDetail.advances?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <Wallet size={12} /> {t('dashboard.cashAdvance')} ({billDetail.advances.length})
                                            </p>
                                            <div className="rounded-xl border border-gray-200/60 overflow-hidden shadow-sm">
                                                {billDetail.advances.map((a, i) => (
                                                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-200/60 last:border-0 ${i % 2 === 0 ? "bg-white/50" : "bg-gray-50/30"} backdrop-blur-sm`}>
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-700">{a.remarks || (a.type === "given" ? t('dashboard.advanceGiven') : t('dashboard.installmentReceived'))}</p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(a.transaction_date)}</p>
                                                        </div>
                                                        <span className={`text-xs font-bold font-mono ${a.type === "given" ? "text-emerald-600" : "text-rose-600"}`}>
                                                            {a.type === "given" ? "+" : "−"} ₹{fmt(a.amount)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Product sales in this cycle */}
                                    {billDetail.productSales?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                                <ShoppingBag size={12} /> {t('farmerDashboard.myProductPurchases')} ({billDetail.productSales.length})
                                            </p>
                                            <div className="rounded-xl border border-gray-200/60 overflow-hidden shadow-sm">
                                                {billDetail.productSales.map((p, i) => (
                                                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-200/60 last:border-0 ${i % 2 === 0 ? "bg-white/50" : "bg-amber-50/30"} backdrop-blur-sm`}>
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-700">{p.product_name}</p>
                                                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(p.sale_date)} · {p.quantity} {p.unit || ""}</p>
                                                        </div>
                                                        <span className="text-xs font-bold font-mono text-amber-700">− ₹{fmt(p.total_amount)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-200/60">
                                        <span>{t('farmerDashboard.billNoLabel')}: <strong className="text-gray-600 font-mono">{billDetail.payment.bill_no}</strong></span>
                                        {billDetail.payment.paid_at && (
                                            <span>{t('farmerDashboard.paidOn')}: {fmtDate(billDetail.payment.paid_at)}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}