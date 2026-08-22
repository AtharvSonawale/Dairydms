// src/pages/farmer/FarmerFinance.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Wallet, PiggyBank, ChevronRight, AlertTriangle,
    TrendingUp, TrendingDown, Home, BadgeCheck, X, Calendar,
    Droplets
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ── helpers (mirrors FarmerMilkEntries.jsx / FarmerDashboard.jsx) ──────
const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const today = () => new Date().toISOString().split("T")[0];

// Fixed monthly payment cycles: 1–10, 11–20, 21–end of month
// (mirrors SellerPayments.jsx / FarmerDashboard.jsx / FarmerMilkEntries.jsx)
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

const getActiveFixedCycle = (refDate = new Date()) => {
    const d = new Date(refDate);
    d.setHours(0, 0, 0, 0);
    const cycles = getFixedMonthCycles(d);
    return cycles.find(c => {
        const s = new Date(c.from + 'T00:00:00');
        const e = new Date(c.to + 'T00:00:00');
        return d >= s && d <= e;
    }) || cycles[0];
};

// ── sub-components ──────────────────────────────────────────────────
function EmptyState({ icon, msg }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 gap-3 text-gray-400">
            <div className="p-4 rounded-full bg-gray-100/50">{icon}</div>
            <p className="text-sm font-medium">{msg}</p>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );
}

function StatCard({ label, value, sub, icon, color }) {
    const colorMap = {
        red: "from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        slate: "from-slate-50 to-slate-100/50 border-slate-200/60 text-slate-700",
        gray: "from-gray-50 to-gray-100/50 border-gray-200/60 text-gray-700",
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
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

function FilterBar({ filter, setFilter, from, setFrom, to, setTo, onReset }) {
    const { t } = useTranslation();
    const presets = ["all", "day", "week", "month", "year", "custom"];
    return (
        <div className="flex flex-wrap items-center gap-2 py-2 pb-3 border-b border-gray-200/60">
            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-bold bg-white/50 backdrop-blur-sm shadow-sm">
                {presets.map(p => (
                    <button key={p} onClick={() => { setFilter(p); onReset(); }}
                        className={`px-3.5 py-2 transition-all duration-200
                            ${filter === p ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}>
                        {t(`dashboard.${p}`, { defaultValue: p })}
                    </button>
                ))}
            </div>
            {filter === "custom" && (
                <div className="flex items-center gap-2">
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition" />
                </div>
            )}
        </div>
    );
}

function Paginator({ total, page, setPage, pageSize, setPageSize }) {
    const totalPages = Math.ceil(total / pageSize);
    if (total === 0) return null;
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-1 border-t border-gray-200/60">
            <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm">
                    ← Prev
                </button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce((acc, p, idx, arr) => {
                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                            acc.push(p);
                            return acc;
                        }, [])
                        .map((p, i) => p === "..."
                            ? <span key={`d${i}`} className="px-1 text-xs text-gray-400">…</span>
                            : <button key={p} onClick={() => setPage(p)}
                                className={`w-7 h-7 rounded-lg text-xs font-bold transition border shadow-sm
                                    ${page === p ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-500 border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50"}`}>
                                {p}
                            </button>
                        )}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm">
                    Next →
                </button>
                <span className="text-xs text-gray-400 ml-1">
                    {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Rows:</span>
                <input type="number" min={1} max={total || 1} value={pageSize}
                    onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setPage(1); }}
                    className="w-14 border border-gray-200/60 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
            </div>
        </div>
    );
}

// Shared date-filter logic (mirrors FarmerMilkEntries.jsx)
const applyDateFilter = (list, dateKey, filter, from, to) => {
    const now = new Date();
    let f, tt;
    if (filter === "custom") {
        f = from ? new Date(from) : null;
        tt = to ? new Date(to + "T23:59:59") : null;
    } else if (filter === "day") {
        f = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        tt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (filter === "week") {
        const day = now.getDay();
        f = new Date(now); f.setDate(now.getDate() - day);
        tt = new Date(now);
    } else if (filter === "month") {
        f = new Date(now.getFullYear(), now.getMonth(), 1);
        tt = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filter === "year") {
        f = new Date(now.getFullYear(), 0, 1);
        tt = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else {
        return list;
    }
    return list.filter(e => {
        const raw = e[dateKey];
        const d = raw && raw.length === 10 ? new Date(raw + "T12:00:00") : new Date(raw);
        return (!f || d >= f) && (!tt || d <= tt);
    });
};

const inCycle = (raw, cycle) => {
    const d = raw && raw.length === 10 ? new Date(raw + "T12:00:00") : new Date(raw);
    const s = new Date(cycle.from + 'T00:00:00');
    const e = new Date(cycle.to + 'T23:59:59');
    return d >= s && d <= e;
};

// ── Main ────────────────────────────────────────────────────────────
export default function FarmerFinance() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const [advances, setAdvances] = useState([]);
    const [deposits, setDeposits] = useState([]);
    const [balances, setBalances] = useState({ advance_balance: 0, deposit_balance: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Payment Cycle is the priority/default view; Custom Period is optional
    const [viewMode, setViewMode] = useState('cycle'); // 'cycle' | 'period'
    const [selectedDate, setSelectedDate] = useState(today());

    const [filter, setFilter] = useState("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");

    const PAGE_SIZE_DEFAULT = 10;
    const [advPage, setAdvPage] = useState(1);
    const [advPageSize, setAdvPageSize] = useState(PAGE_SIZE_DEFAULT);
    const [depPage, setDepPage] = useState(1);
    const [depPageSize, setDepPageSize] = useState(PAGE_SIZE_DEFAULT);

    const activeCycle = getActiveFixedCycle(new Date(selectedDate + 'T00:00:00'));

    // Expected shape from GET /api/farmer/finance (own-seller-only,
    // enforced server-side via requireRole('seller') + WHERE seller_id = req.user.id
    // — mirrors /farmer/milk-entries and /farmer/dashboard):
    // { advances: [], deposits: [], balances: { advance_balance, deposit_balance } }
    const fetchFinance = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/farmer/finance");
            setAdvances(data?.advances || []);
            setDeposits(data?.deposits || []);
            setBalances(data?.balances || { advance_balance: 0, deposit_balance: 0 });
        } catch {
            setError(t('dashboard.loadFailed', { defaultValue: 'Failed to load advance & deposit data' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchFinance(); }, []);

    useEffect(() => { setAdvPage(1); setDepPage(1); }, [viewMode, selectedDate, filter, customFrom, customTo]);

    const filteredAdvances = viewMode === 'cycle'
        ? advances.filter(a => inCycle(a.transaction_date, activeCycle))
        : applyDateFilter(advances, 'transaction_date', filter, customFrom, customTo);

    const filteredDeposits = viewMode === 'cycle'
        ? deposits.filter(d => inCycle(d.transaction_date, activeCycle))
        : applyDateFilter(deposits, 'transaction_date', filter, customFrom, customTo);

    const pagedAdvances = filteredAdvances.slice((advPage - 1) * advPageSize, advPage * advPageSize);
    const pagedDeposits = filteredDeposits.slice((depPage - 1) * depPageSize, depPage * depPageSize);

    const advGiven = filteredAdvances.filter(a => a.type === "given").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const advReceived = filteredAdvances.filter(a => a.type === "received").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const depCredit = filteredDeposits.filter(d => d.type === "credit").reduce((s, e) => s + parseFloat(e.amount || 0), 0);
    const depDebit = filteredDeposits.filter(d => d.type === "debit").reduce((s, e) => s + parseFloat(e.amount || 0), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('nav.myFinance', { defaultValue: 'Advance & Deposit' })}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {user?.name} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <Link to="/farmer/dashboard"
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 text-xs font-bold hover:bg-gray-50/80 transition shadow-sm">
                            <ArrowLeft size={15} /> {t('actions.back', { defaultValue: 'Back' })}
                        </Link>
                    </div>
                </div>

                {/* ── Flash ── */}
                {error && (
                    <div className="flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-semibold backdrop-blur-sm shadow-sm bg-rose-50/80 border border-rose-200/60 text-rose-600">
                        <AlertTriangle size={18} />
                        {error}
                        <button onClick={() => setError(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Balance overview ── */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Droplets size={14} /> {t('dashboard.myOverview', { defaultValue: 'My Overview' })}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard
                            label={t('dashboard.advanceBalance', { defaultValue: 'Advance Balance' })}
                            value={"₹" + fmt(balances.advance_balance)}
                            sub={t('dashboard.outstanding', { defaultValue: 'Outstanding with you' })}
                            icon={<Wallet size={16} />}
                            color={balances.advance_balance > 0 ? "red" : "slate"}
                        />
                        <StatCard
                            label={t('dashboard.depositBalance', { defaultValue: 'Deposit Balance' })}
                            value={"₹" + fmt(balances.deposit_balance)}
                            sub={t('dashboard.heldByDairy', { defaultValue: 'Held by dairy' })}
                            icon={<PiggyBank size={16} />}
                            color="violet"
                        />
                        <StatCard
                            label={t('dashboard.given', { defaultValue: 'Given (period)' })}
                            value={"₹" + fmt(advGiven)}
                            sub={`${filteredAdvances.filter(a => a.type === "given").length} ${t('dashboard.transactions')}`}
                            icon={<TrendingUp size={16} />}
                            color="emerald"
                        />
                        <StatCard
                            label={t('dashboard.received', { defaultValue: 'Received (period)' })}
                            value={"₹" + fmt(advReceived)}
                            sub={`${filteredAdvances.filter(a => a.type === "received").length} ${t('dashboard.transactions')}`}
                            icon={<TrendingDown size={16} />}
                            color="amber"
                        />
                    </div>
                </div>

                {/* ── Current Payment Cycle / Custom Period indicator ── */}
                <div className="relative overflow-hidden rounded-2xl border border-emerald-200/60 bg-emerald-50/80 backdrop-blur-sm shadow-lg shadow-emerald-200/50 px-5 py-4">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-emerald-400/5 blur-3xl" />
                    <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                                <Calendar size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                                    {viewMode === 'cycle'
                                        ? t('dashboard.currentPaymentCycle', { defaultValue: 'Current Payment Cycle' })
                                        : t('dashboard.customPeriodViewing', { defaultValue: 'Viewing Custom Period' })}
                                </p>
                                <p className="text-sm font-bold text-gray-900 leading-tight">
                                    {viewMode === 'cycle'
                                        ? <>{activeCycle.label} <span className="font-normal text-gray-400">·</span> {fmtDate(activeCycle.from)} – {fmtDate(activeCycle.to)}</>
                                        : <>{filteredAdvances.length + filteredDeposits.length} {t('dashboard.transactions')} {t('dashboard.matchingFilter', { defaultValue: 'matching filter' })}</>}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-bold bg-white/50 backdrop-blur-sm shadow-sm">
                                <button
                                    onClick={() => setViewMode('cycle')}
                                    className={`px-3.5 py-2 transition-all duration-200 ${viewMode === 'cycle' ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}
                                >
                                    {t('dashboard.paymentCycle', { defaultValue: 'Payment Cycle' })}
                                </button>
                                <button
                                    onClick={() => setViewMode('period')}
                                    className={`px-3.5 py-2 transition-all duration-200 ${viewMode === 'period' ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}
                                >
                                    {t('dashboard.customPeriod', { defaultValue: 'Custom Period' })}
                                </button>
                            </div>

                            {viewMode === 'cycle' && (
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                            )}
                        </div>
                    </div>
                </div>

                {loading && <Spinner />}

                {!loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* ── Cash Advance ── */}
                        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                                        <Wallet size={15} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 leading-tight">{t('dashboard.cashAdvance', { defaultValue: 'Cash Advance' })}</p>
                                        <p className="text-[10px] text-gray-500">{filteredAdvances.length} {t('dashboard.transactions')}</p>
                                    </div>
                                </div>

                                {viewMode === 'period' && (
                                    <FilterBar filter={filter} setFilter={setFilter}
                                        from={customFrom} setFrom={setCustomFrom}
                                        to={customTo} setTo={setCustomTo}
                                        onReset={() => setAdvPage(1)} />
                                )}

                                {filteredAdvances.length === 0 ? (
                                    <EmptyState icon={<Wallet size={32} />} msg={t('dashboard.noAdvances', { defaultValue: 'No advance transactions' })} />
                                ) : (
                                    <div className="flex flex-col divide-y divide-gray-100/60">
                                        {pagedAdvances.map((a) => (
                                            <div key={a.id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${a.type === "given" ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30" : "bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30"}`}>
                                                        {a.type === "given" ? <TrendingUp size={14} className="text-white" /> : <TrendingDown size={14} className="text-white" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-gray-700 truncate">
                                                            {a.remarks || (a.type === "given" ? t('dashboard.advanceGiven', { defaultValue: 'Advance given' }) : t('dashboard.installmentReceived', { defaultValue: 'Installment received' }))}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">{fmtDate(a.transaction_date)}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-bold shrink-0 ml-3 ${a.type === "given" ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {a.type === "given" ? "+" : "−"}₹{fmt(a.amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Paginator total={filteredAdvances.length} page={advPage} setPage={setAdvPage}
                                    pageSize={advPageSize} setPageSize={setAdvPageSize} />

                                <div className="mt-2 pt-3 border-t border-gray-200/60 flex justify-between text-xs text-gray-500">
                                    <span>{t('dashboard.given', { defaultValue: 'Given' })}: <strong className="text-emerald-600">₹{fmt(advGiven)}</strong></span>
                                    <span>{t('dashboard.received', { defaultValue: 'Received' })}: <strong className="text-rose-600">₹{fmt(advReceived)}</strong></span>
                                </div>
                            </div>
                        </div>

                        {/* ── Deposit ── */}
                        <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                            <div className="relative z-10">
                                <div className="flex items-center gap-2.5 mb-3">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
                                        <PiggyBank size={15} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 leading-tight">{t('dashboard.deposit', { defaultValue: 'Deposit' })}</p>
                                        <p className="text-[10px] text-gray-500">{filteredDeposits.length} {t('dashboard.transactions')}</p>
                                    </div>
                                </div>

                                {viewMode === 'period' && (
                                    <FilterBar filter={filter} setFilter={setFilter}
                                        from={customFrom} setFrom={setCustomFrom}
                                        to={customTo} setTo={setCustomTo}
                                        onReset={() => setDepPage(1)} />
                                )}

                                {filteredDeposits.length === 0 ? (
                                    <EmptyState icon={<PiggyBank size={32} />} msg={t('dashboard.noDeposits', { defaultValue: 'No deposit activity yet' })} />
                                ) : (
                                    <div className="flex flex-col divide-y divide-gray-100/60">
                                        {pagedDeposits.map((d) => (
                                            <div key={d.id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-lg shrink-0 ${d.type === "credit" ? "bg-gradient-to-br from-violet-500 to-violet-600 shadow-violet-500/30" : "bg-gradient-to-br from-gray-500 to-gray-600 shadow-gray-500/30"}`}>
                                                        {d.type === "credit" ? <TrendingUp size={14} className="text-white" /> : <TrendingDown size={14} className="text-white" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-gray-700 truncate">
                                                            {d.remarks || (d.type === "credit" ? t('dashboard.depositAdded', { defaultValue: 'Deposit added' }) : t('dashboard.depositWithdrawn', { defaultValue: 'Deposit withdrawn' }))}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">{fmtDate(d.transaction_date)}</p>
                                                    </div>
                                                </div>
                                                <span className={`text-xs font-bold shrink-0 ml-3 ${d.type === "credit" ? "text-violet-600" : "text-gray-600"}`}>
                                                    {d.type === "credit" ? "+" : "−"}₹{fmt(d.amount)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <Paginator total={filteredDeposits.length} page={depPage} setPage={setDepPage}
                                    pageSize={depPageSize} setPageSize={setDepPageSize} />

                                <div className="mt-2 pt-3 border-t border-gray-200/60 flex justify-between text-xs text-gray-500">
                                    <span>{t('dashboard.added', { defaultValue: 'Added' })}: <strong className="text-violet-600">₹{fmt(depCredit)}</strong></span>
                                    <span>{t('dashboard.withdrawn', { defaultValue: 'Withdrawn' })}: <strong className="text-gray-600">₹{fmt(depDebit)}</strong></span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-600">{viewMode === 'cycle' ? activeCycle.label : filter}</strong> {t('dashboard.footerData')}: {viewMode === 'cycle' ? `${fmtDate(activeCycle.from)} – ${fmtDate(activeCycle.to)}` : `${fmtDate(customFrom) || 'start'} – ${fmtDate(customTo) || 'end'}`}</span>
                    <span>· {t('dashboard.farmerFooter', { defaultValue: 'Showing only your own records' })}</span>
                </div>

            </main>
        </div>
    );
}