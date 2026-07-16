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
    const colors = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        red: "text-red-500 bg-red-50 border-red-100",
        slate: "text-slate-600 bg-slate-50 border-slate-200",
        indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
        teal: "text-teal-600 bg-teal-50 border-teal-100",
    };
    return (
        <div className={`flex flex-col gap-2 px-4 py-4 rounded-2xl border ${colors[color]} relative overflow-hidden`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-80">{icon}</div>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
            {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
    );
}

function SectionHeader({ icon, title, sub, action }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center">
                    {icon}
                </div>
                <div>
                    <p className="text-sm font-bold text-gray-800 leading-tight">{title}</p>
                    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
                </div>
            </div>
            {action}
        </div>
    );
}

function ShiftBadge({ shift, t }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase
            ${shift === "morning"
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
            {shift === "morning" ? <Sun size={8} /> : <Moon size={8} />}
            {shift === "morning" ? t('bill.morning') : t('bill.evening')}
        </span>
    );
}

function MilkTypeBadge({ type }) {
    return (
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full
            ${type === "cow"
                ? "bg-amber-50 text-amber-700 border border-amber-100"
                : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
            {type}
        </span>
    );
}

function EmptyState({ icon, text }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
            {icon}
            <p className="text-xs">{text}</p>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
    );
}

function Paginator({ total, page, setPage, pageSize }) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (total === 0) return null;
    return (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-50">
            <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
            >
                ← Prev
            </button>
            <span className="text-[11px] text-gray-400">
                Page {page} of {totalPages} · {total} records
            </span>
            <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
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
            showFlash("error", t('dashboard.billLoadFailed', { defaultValue: 'Failed to load bill details' }));
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

    // Expected shape from GET /api/farmer/dashboard?from&to (own-seller-only,
    // enforced server-side via requireRole('seller') + WHERE seller_id = req.user.id
    // — NOT a query param, so a farmer can never pass someone else's id):
    // { milk_entries: [], bills: [], advances: [], deposits: [],
    //   balances: { advance_balance, deposit_balance } }
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
            showFlash("error", t('dashboard.loadFailed', { defaultValue: 'Failed to load dashboard data' }));
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
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                            {greeting.icon}
                            <span>{greeting.text},</span>
                            <span className="font-semibold text-gray-800">{user?.name || t('status.farmer', { defaultValue: 'Farmer' })}</span>
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 text-[10px] font-semibold ml-1">
                                <User size={10} /> {t('status.farmer', { defaultValue: 'Farmer' })}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 leading-tight" data-tour="dashboard-title">
                            {t('dashboard.myDashboard', { defaultValue: 'My Dashboard' })}
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Mode toggle: Payment Cycle (priority) vs Custom Period (optional) */}
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold flex-shrink-0">
                            <button
                                onClick={() => setViewMode('cycle')}
                                className={`px-3 py-1.5 transition ${viewMode === 'cycle' ? "bg-emerald-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                                {t('dashboard.paymentCycle', { defaultValue: 'Payment Cycle' })}
                            </button>
                            <button
                                onClick={() => setViewMode('period')}
                                className={`px-3 py-1.5 transition ${viewMode === 'period' ? "bg-emerald-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                                {t('dashboard.customPeriod', { defaultValue: 'Custom Period' })}
                            </button>
                        </div>

                        {/* Optional day/week/month/year filters — only shown in Custom Period mode */}
                        {viewMode === 'period' && (
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold flex-shrink-0 w-40">
                                {['day', 'week', 'month', 'year'].map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setPeriod(p)}
                                        className={`flex-1 py-1.5 transition ${period === p ? "bg-emerald-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                                    >
                                        {t(`dashboard.${p}`)}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider hidden sm:inline">
                                {t('dashboard.referenceDate')}
                            </span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-1.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition w-36"
                            />
                        </div>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold flex-shrink-0">
                            <Calendar size={12} className="flex-shrink-0" />
                            <span className="truncate">
                                {viewMode === 'cycle'
                                    ? `${t('dashboard.cycle', { defaultValue: 'Cycle' })} ${activeCycle.label}: ${fmtCycleRange(rangeFrom, rangeTo)}`
                                    : formatPeriodLabel(period, rangeFrom, rangeTo)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Current Payment Cycle / Custom Period indicator */}
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/60">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
                            <Calendar size={14} className="text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
                                {viewMode === 'cycle'
                                    ? t('dashboard.currentPaymentCycle', { defaultValue: 'Current Payment Cycle' })
                                    : t('dashboard.customPeriodViewing', { defaultValue: 'Viewing Custom Period' })}
                            </p>
                            <p className="text-sm font-bold text-gray-900 leading-tight">
                                {viewMode === 'cycle'
                                    ? <>{activeCycle.label} <span className="font-normal text-gray-400">·</span> {fmtDate(rangeFrom)} – {fmtDate(rangeTo)}</>
                                    : <>{formatPeriodLabel(period, rangeFrom, rangeTo)}</>}
                            </p>
                        </div>
                    </div>
                    <span className="text-[10px] font-medium text-emerald-500">
                        {viewMode === 'cycle'
                            ? t('dashboard.cycleNote', { defaultValue: 'Data below reflects this cycle only' })
                            : t('dashboard.periodNote', { defaultValue: 'Data below reflects this custom period' })}
                    </span>
                </div>

                {/* Flash message */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        <AlertTriangle size={15} />
                        {flash.msg}
                    </div>
                )}

                {/* Shift Priority Banner */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-amber-100 bg-amber-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center shadow-sm shadow-amber-200">
                                <Sun size={18} className="text-amber-900" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider">{t('dashboard.morningShift')}</p>
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

                    <div className="flex items-center justify-between px-5 py-4 rounded-2xl border border-indigo-100 bg-indigo-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-sm shadow-indigo-200">
                                <Moon size={18} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wider">{t('dashboard.eveningShift')}</p>
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

                {/* Earnings + Balances Overview */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
                        {t('dashboard.myOverview', { defaultValue: 'My Overview' })}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label={t('dashboard.milkDelivered', { defaultValue: 'Milk Delivered' })}
                            value={totalMilkQty.toFixed(1) + " L"}
                            sub={`${milkEntries.length} ${t('dashboard.entries')}`}
                            icon={<Milk size={15} />} color="amber"
                        />
                        <StatCard
                            label={t('dashboard.milkEarnings', { defaultValue: 'Milk Earnings' })}
                            value={"₹" + fmt(totalMilkAmt)}
                            sub={viewMode === 'cycle' ? fmtCycleRange(rangeFrom, rangeTo) : formatPeriodLabel(period, rangeFrom, rangeTo)}
                            icon={<Banknote size={15} />} color="emerald"
                        />
                        <StatCard
                            label={t('dashboard.advanceBalance', { defaultValue: 'Advance Balance' })}
                            value={"₹" + fmt(balances.advance_balance)}
                            sub={t('dashboard.outstanding', { defaultValue: 'Outstanding with you' })}
                            icon={<Wallet size={15} />} color={balances.advance_balance > 0 ? "red" : "slate"}
                        />
                        <StatCard
                            label={t('dashboard.depositBalance', { defaultValue: 'Deposit Balance' })}
                            value={"₹" + fmt(balances.deposit_balance)}
                            sub={t('dashboard.heldByDairy', { defaultValue: 'Held by dairy' })}
                            icon={<PiggyBank size={15} />} color="violet"
                        />
                    </div>
                </div>

                {/* Milk Quality & Breakdown */}
                <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{t('dashboard.milkCollection')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex flex-col gap-2 px-4 py-4 rounded-2xl border border-indigo-100 bg-indigo-50 col-span-2 sm:col-span-1">
                            <div className="flex items-center justify-between">
                                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60">{t('dashboard.avgFatSnf')}</p>
                                <FlaskConical size={15} className="opacity-70" />
                            </div>
                            <p className="text-lg font-bold text-gray-900">{avgFat.toFixed(2)} / {avgSnf.toFixed(2)}</p>
                            <p className="text-[10px] text-gray-400">{t('dashboard.acrossAllEntries', { defaultValue: 'Across all your entries this period' })}</p>
                        </div>

                        {[
                            { label: t('bill.morning'), qty: morningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: morningEntries.length, icon: <Sun size={13} />, color: "text-amber-600 bg-amber-50 border-amber-100" },
                            { label: t('bill.evening'), qty: eveningEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: eveningEntries.length, icon: <Moon size={13} />, color: "text-indigo-600 bg-indigo-50 border-indigo-100" },
                            { label: t('dashboard.cow'), qty: cowEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0), count: cowEntries.length, icon: null, color: "text-amber-700 bg-amber-50 border-amber-100" },
                        ].map(({ label, qty, count, icon, color }) => (
                            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                                {icon && <div className="shrink-0">{icon}</div>}
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                    <p className="text-base font-bold text-gray-900">{qty.toFixed(1)} L</p>
                                    <p className="text-[10px] text-gray-400">{count} {t('dashboard.entries')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Recent Milk Entries */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader
                        icon={<Milk size={13} className="text-white" />}
                        title={t('dashboard.myMilkEntries', { defaultValue: 'My Milk Entries' })}
                        sub={`${milkEntries.length} ${t('dashboard.total')} · ${viewMode === 'cycle' ? fmtCycleRange(rangeFrom, rangeTo) : formatPeriodLabel(period, rangeFrom, rangeTo)}`}
                        action={
                            <Link to="/farmer/milk-entries" className="text-[11px] font-semibold text-emerald-700 hover:underline">
                                {t('dashboard.viewAll', { defaultValue: 'View All' })} →
                            </Link>
                        }
                    />
                    {load.milk ? <Spinner /> : pagedMilk.length === 0 ? (
                        <EmptyState icon={<Milk size={28} />} text={t('dashboard.noMilkEntries')} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {pagedMilk.map((e) => (
                                <div key={e.entry_id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                            <Milk size={12} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800">{fmtDate(e.entry_date)}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <ShiftBadge shift={e.shift} t={t} />
                                                <MilkTypeBadge type={e.milk_type} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-xs font-bold text-gray-800">{parseFloat(e.quantity).toFixed(1)} L</p>
                                        <p className="text-[10px] text-gray-400">{t('bill.fat')} {parseFloat(e.fat).toFixed(1)} · {t('bill.snf')} {parseFloat(e.snf).toFixed(1)}</p>
                                        <p className="text-[10px] text-emerald-600 font-semibold">₹{fmt(e.total_amount)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Paginator total={milkEntries.length} page={milkPage} setPage={setMilkPage} pageSize={PAGE_SIZE} />
                </div>

                {/* My Bills */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader
                        icon={<Receipt size={13} className="text-white" />}
                        title={t('dashboard.myBills', { defaultValue: 'My Bills' })}
                        sub={`${bills.length} ${t('dashboard.total')}`}
                        action={
                            <Link to="/farmer/bills" className="text-[11px] font-semibold text-emerald-700 hover:underline">
                                {t('dashboard.viewAll', { defaultValue: 'View All' })} →
                            </Link>
                        }
                    />
                    {load.bills ? <Spinner /> : pagedBills.length === 0 ? (
                        <EmptyState icon={<Receipt size={28} />} text={t('dashboard.noBills', { defaultValue: 'No bills yet for this period' })} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                                {pagedBills.map((b) => (
                                    <div key={b.bill_id} className="flex items-center justify-between py-2.5">
                                        <div className="min-w-0">
                                            <button onClick={() => openBillDetail(b.bill_no)}
                                                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-2 transition">
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

                {/* Advance & Deposit History */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<Wallet size={13} className="text-white" />}
                            title={t('dashboard.cashAdvance')}
                            sub={`${advances.length} ${t('dashboard.transactions')}`}
                        />
                        {load.advance ? <Spinner /> : pagedAdvances.length === 0 ? (
                            <EmptyState icon={<Wallet size={28} />} text={t('dashboard.noAdvances')} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {pagedAdvances.map((a) => (
                                    <div key={a.id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${a.type === "given" ? "bg-emerald-500" : "bg-red-500"}`}>
                                                {a.type === "given" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 truncate">{a.remarks || (a.type === "given" ? t('dashboard.advanceGiven') : t('dashboard.installmentReceived'))}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className={`text-xs font-bold ${a.type === "given" ? "text-emerald-600" : "text-red-500"}`}>
                                                {a.type === "given" ? "+" : "−"}₹{fmt(a.amount)}
                                            </p>
                                            <p className="text-[10px] text-gray-400">{fmtDate(a.transaction_date)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Paginator total={advances.length} page={advPage} setPage={setAdvPage} pageSize={PAGE_SIZE} />
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
                            <span>{t('dashboard.given', { defaultValue: 'Given' })}: <strong className="text-emerald-600">₹{fmt(advGiven)}</strong></span>
                            <span>{t('dashboard.received', { defaultValue: 'Received' })}: <strong className="text-red-500">₹{fmt(advReceived)}</strong></span>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <SectionHeader
                            icon={<PiggyBank size={13} className="text-white" />}
                            title={t('dashboard.deposit', { defaultValue: 'Deposit' })}
                            sub={`${deposits.length} ${t('dashboard.transactions')}`}
                        />
                        {load.deposit ? <Spinner /> : pagedDeposits.length === 0 ? (
                            <EmptyState icon={<PiggyBank size={28} />} text={t('dashboard.noDeposits', { defaultValue: 'No deposit activity yet' })} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-50">
                                {pagedDeposits.map((d) => (
                                    <div key={d.id} className="flex items-center justify-between py-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${d.type === "credit" ? "bg-violet-500" : "bg-gray-400"}`}>
                                                {d.type === "credit" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                            </div>
                                            <p className="text-[10px] text-gray-400 truncate">{d.remarks || (d.type === "credit" ? t('dashboard.depositAdded', { defaultValue: 'Deposit added' }) : t('dashboard.depositWithdrawn', { defaultValue: 'Deposit withdrawn' }))}</p>
                                        </div>
                                        <div className="text-right shrink-0 ml-3">
                                            <p className={`text-xs font-bold ${d.type === "credit" ? "text-violet-600" : "text-gray-500"}`}>
                                                {d.type === "credit" ? "+" : "−"}₹{fmt(d.amount)}
                                            </p>
                                            <p className="text-[10px] text-gray-400">{fmtDate(d.transaction_date)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <Paginator total={deposits.length} page={depPage} setPage={setDepPage} pageSize={PAGE_SIZE} />
                        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
                            <span>{t('dashboard.added', { defaultValue: 'Added' })}: <strong className="text-violet-600">₹{fmt(depCredit)}</strong></span>
                            <span>{t('dashboard.withdrawn', { defaultValue: 'Withdrawn' })}: <strong className="text-gray-500">₹{fmt(depDebit)}</strong></span>
                        </div>
                    </div>
                </div>

                {/* My Premium Rates */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader
                        icon={<FlaskConical size={13} className="text-white" />}
                        title={t('dashboard.myPremiumRates', { defaultValue: 'My Premium Rates' })}
                        sub={`${premiumRates.length} ${t('dashboard.total')}`}
                    />
                    {pagedPremium.length === 0 ? (
                        <EmptyState icon={<FlaskConical size={28} />} text={t('dashboard.noPremiumRates', { defaultValue: 'No premium rates assigned' })} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {pagedPremium.map((r) => (
                                <div key={r.id} className="flex items-center justify-between py-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <MilkTypeBadge type={r.milk_type} />
                                        <p className="text-[10px] text-gray-400 truncate">{r.reason || "—"}</p>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-xs font-bold text-gray-800">₹{fmt(r.rate_per_liter)} /L</p>
                                        <p className="text-[10px] text-gray-400">{fmtDate(r.effective_from)} – {r.effective_to ? fmtDate(r.effective_to) : t('dashboard.ongoing', { defaultValue: 'Ongoing' })}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Paginator total={premiumRates.length} page={premPage} setPage={setPremPage} pageSize={PAGE_SIZE} />
                </div>

                {/* My Product Purchases */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    <SectionHeader
                        icon={<ShoppingBag size={13} className="text-white" />}
                        title={t('dashboard.myProductPurchases', { defaultValue: 'My Product Purchases' })}
                        sub={`${productSales.length} ${t('dashboard.total')} · ${viewMode === 'cycle' ? fmtCycleRange(rangeFrom, rangeTo) : formatPeriodLabel(period, rangeFrom, rangeTo)}`}
                    />
                    {pagedProducts.length === 0 ? (
                        <EmptyState icon={<ShoppingBag size={28} />} text={t('dashboard.noProductPurchases', { defaultValue: 'No product purchases this period' })} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {pagedProducts.map((p) => (
                                <div key={p.sale_id} className="flex items-center justify-between py-2.5">
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

                {/* Footer */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-4">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-600">{viewMode === 'cycle' ? activeCycle.label : period}</strong> {t('dashboard.footerData')}: {fmtDate(rangeFrom)} – {fmtDate(rangeTo)}</span>

                    <span>· {t('dashboard.farmerFooter', { defaultValue: 'Showing only your own records' })}</span>
                </div>
            </main>

            {/* Bill Detail Modal */}
            {billModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center rounded-t-2xl justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-emerald-50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono font-bold text-emerald-700">{billDetail?.payment?.bill_no}</span>
                                    {billDetail?.payment?.paid_at && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                                            {t('dashboard.paid', { defaultValue: 'Paid' })}
                                        </span>
                                    )}
                                </div>
                                {billDetail?.payment && (
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        {fmtDate(billDetail.payment.from_date)} → {fmtDate(billDetail.payment.to_date)}
                                    </p>
                                )}
                            </div>
                            <button onClick={closeBillDetail}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 transition">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="flex-1 rounded-2xl overflow-y-auto px-6 py-5">
                            {billDetailLoading ? (
                                <Spinner />
                            ) : !billDetail ? (
                                <EmptyState icon={<Receipt size={28} />} text={t('dashboard.billLoadFailed', { defaultValue: 'Failed to load bill details' })} />
                            ) : (
                                <div className="flex flex-col gap-5">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <StatCard label={t('dashboard.milkAmount', { defaultValue: 'Milk Amount' })}
                                            value={`₹${fmt(billDetail.payment.milk_amount)}`} icon={<Milk size={13} />} color="emerald" />
                                        <StatCard label={t('dashboard.total', { defaultValue: 'Total' }) + ' ' + t('dashboard.entries')}
                                            value={billDetail.entries.length} icon={<Receipt size={13} />} color="blue" />
                                        <StatCard label={t('dashboard.totalQty', { defaultValue: 'Total Qty' })}
                                            value={`${billDetail.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L`}
                                            icon={<FlaskConical size={13} />} color="amber" />
                                        <StatCard label={t('dashboard.netCashPaid', { defaultValue: 'Net Cash Paid' })}
                                            value={`₹${fmt(billDetail.payment.cash_paid)}`} icon={<Banknote size={13} />} color="violet" />
                                    </div>

                                    {/* Milk entries table */}
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                            {t('dashboard.milkCollectionEntries', { defaultValue: 'Milk Collection Entries' })} ({billDetail.entries.length})
                                        </p>
                                        <div className="rounded-xl border border-gray-100 overflow-x-auto">
                                            <table className="w-full text-xs min-w-max">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        {[t('bill.date', { defaultValue: 'Date' }), t('bill.shift'), t('dashboard.milkType', { defaultValue: 'Type' }), t('dashboard.qty', { defaultValue: 'Qty (L)' }), t('bill.fat'), t('bill.snf'), t('bill.rate', { defaultValue: 'Rate' }), t('bill.amount')].map(h => (
                                                            <th key={h} className="px-3 py-2 text-left font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-50">
                                                    {billDetail.entries.map((e, i) => (
                                                        <tr key={i} className="hover:bg-gray-50 transition">
                                                            <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                                                            <td className="px-3 py-2"><ShiftBadge shift={e.shift} t={t} /></td>
                                                            <td className="px-3 py-2"><MilkTypeBadge type={e.milk_type} /></td>
                                                            <td className="px-3 py-2 font-mono text-blue-600 font-semibold">{parseFloat(e.quantity || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2 font-mono text-amber-600">{parseFloat(e.fat || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2 font-mono text-violet-600">{parseFloat(e.snf || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2 font-mono text-gray-600">₹{parseFloat(e.rate_applied || 0).toFixed(2)}</td>
                                                            <td className="px-3 py-2 font-bold text-gray-800">₹{parseFloat(e.total_amount || 0).toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Payment breakdown */}
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                            {t('dashboard.paymentBreakdown', { defaultValue: 'Payment Breakdown' })}
                                        </p>
                                        <div className="rounded-xl border border-gray-100 overflow-hidden">
                                            {[
                                                { label: t('dashboard.milkAmountPayable', { defaultValue: 'Milk Amount Payable' }), value: billDetail.payment.milk_amount, sign: "+", color: "bg-emerald-50 text-emerald-700" },
                                                { label: t('dashboard.advanceOutstanding', { defaultValue: 'Advance Outstanding' }), value: billDetail.payment.advance_given, sign: "", color: "bg-violet-50 text-violet-700", skipIfZero: true },
                                                { label: t('dashboard.advInstallmentCut', { defaultValue: 'Advance Installment Cut' }), value: billDetail.payment.installment_cut, sign: "−", color: "bg-rose-50 text-rose-700", skipIfZero: true },
                                                { label: t('dashboard.depositDeducted', { defaultValue: 'Deposit Deducted' }), value: billDetail.payment.deposit_amount, sign: "−", color: "bg-blue-50 text-blue-700", skipIfZero: true },
                                                { label: t('dashboard.productSalesDeduction', { defaultValue: 'Product Sales Deduction' }), value: billDetail.payment.product_deduction, sign: "−", color: "bg-amber-50 text-amber-700", skipIfZero: true },
                                                { label: t('dashboard.milkBoughtDeduction', { defaultValue: 'Milk Bought (Walk-in)' }), value: billDetail.payment.walkin_deduction, sign: "−", color: "bg-orange-50 text-orange-700", skipIfZero: true },
                                            ].filter(row => !row.skipIfZero || parseFloat(row.value || 0) > 0).map((row, i) => (
                                                <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 ${row.color}`}>
                                                    <span className="text-xs font-medium">{row.label}</span>
                                                    <span className="text-xs font-bold font-mono">{row.sign} ₹{fmt(row.value)}</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between px-4 py-3.5 bg-gray-900 text-white">
                                                <span className="text-xs font-bold uppercase tracking-wider">{t('dashboard.netCashToHand', { defaultValue: 'Net Cash To Hand' })}</span>
                                                <span className="text-base font-bold font-mono">₹{fmt(billDetail.payment.final_payable ?? billDetail.payment.cash_paid)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Advances in this cycle */}
                                    {billDetail.advances?.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                {t('dashboard.cashAdvance')} ({billDetail.advances.length})
                                            </p>
                                            <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                {billDetail.advances.map((a, i) => (
                                                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
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
                                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                {t('dashboard.myProductPurchases', { defaultValue: 'Product Purchases' })} ({billDetail.productSales.length})
                                            </p>
                                            <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                {billDetail.productSales.map((p, i) => (
                                                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-amber-50/30"}`}>
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

                                    <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                                        <span>{t('dashboard.billNoLabel', { defaultValue: 'Bill No.' })}: <strong className="text-gray-600 font-mono">{billDetail.payment.bill_no}</strong></span>
                                        {billDetail.payment.paid_at && (
                                            <span>{t('dashboard.paidOn', { defaultValue: 'Paid On' })}: {fmtDate(billDetail.payment.paid_at)}</span>
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