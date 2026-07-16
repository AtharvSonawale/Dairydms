// src/pages/farmer/FarmerFinance.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Wallet, PiggyBank, ChevronRight, AlertTriangle,
    TrendingUp, TrendingDown,
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
        <div className="flex flex-col items-center justify-center py-14 gap-2 text-gray-300">
            {icon}
            <p className="text-sm">{msg}</p>
        </div>
    );
}

function Spinner() {
    return (
        <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
        </div>
    );
}

function StatCard({ label, value, sub, icon, color }) {
    const colors = {
        red: "text-red-500 bg-red-50 border-red-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        slate: "text-slate-600 bg-slate-50 border-slate-200",
        gray: "text-gray-500 bg-gray-50 border-gray-200",
    };
    return (
        <div className={`flex flex-col gap-2 px-4 py-4 rounded-2xl border ${colors[color]} relative overflow-hidden`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-80">{icon}</div>
            </div>
            <p className="text-xl font-bold text-gray-900 leading-tight">{value}</p>
            {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
    );
}

function FilterBar({ filter, setFilter, from, setFrom, to, setTo, onReset }) {
    const { t } = useTranslation();
    const presets = ["all", "day", "week", "month", "year", "custom"];
    return (
        <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-50">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                {presets.map(p => (
                    <button key={p} onClick={() => { setFilter(p); onReset(); }}
                        className={`px-3 py-1.5 capitalize transition
                            ${filter === p ? "bg-emerald-700 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                        {t(`dashboard.${p}`, { defaultValue: p })}
                    </button>
                ))}
            </div>
            {filter === "custom" && (
                <div className="flex items-center gap-2">
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition" />
                </div>
            )}
        </div>
    );
}

function Paginator({ total, page, setPage, pageSize, setPageSize }) {
    const totalPages = Math.ceil(total / pageSize);
    if (total === 0) return null;
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-1 py-3 border-t border-gray-50">
            <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
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
                                className={`w-7 h-7 rounded-lg text-xs font-semibold transition border
                                    ${page === p ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                                {p}
                            </button>
                        )}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
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
                    className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition" />
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
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Breadcrumb + Header */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Link to="/farmer/dashboard" className="hover:text-gray-600 transition">
                        {t('dashboard.myDashboard', { defaultValue: 'My Dashboard' })}
                    </Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-600 font-medium">{t('nav.myFinance', { defaultValue: 'Advance & Deposit' })}</span>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/farmer/dashboard"
                        className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm shrink-0">
                        <ArrowLeft size={16} />
                    </Link>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-700 flex items-center justify-center shrink-0">
                        <Wallet size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">
                            {t('nav.myFinance', { defaultValue: 'Advance & Deposit' })}
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">{user?.name}</p>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium bg-rose-50 border border-rose-200 text-rose-600">
                        <AlertTriangle size={15} /> {error}
                    </div>
                )}

                {/* Balance overview (account-wide, not period-filtered) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <StatCard
                        label={t('dashboard.given', { defaultValue: 'Given (period)' })}
                        value={"₹" + fmt(advGiven)}
                        sub={`${filteredAdvances.filter(a => a.type === "given").length} ${t('dashboard.transactions')}`}
                        icon={<TrendingUp size={15} />} color="emerald"
                    />
                    <StatCard
                        label={t('dashboard.received', { defaultValue: 'Received (period)' })}
                        value={"₹" + fmt(advReceived)}
                        sub={`${filteredAdvances.filter(a => a.type === "received").length} ${t('dashboard.transactions')}`}
                        icon={<TrendingDown size={15} />} color="gray"
                    />
                </div>

                {/* Current Payment Cycle / Custom Period indicator */}
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
                            <Wallet size={14} className="text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
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
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold flex-shrink-0 bg-white">
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

                        {viewMode === 'cycle' && (
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition"
                            />
                        )}
                    </div>
                </div>

                {loading && <Spinner />}

                {!loading && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                        {/* Cash Advance */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
                                    <Wallet size={13} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800 leading-tight">{t('dashboard.cashAdvance', { defaultValue: 'Cash Advance' })}</p>
                                    <p className="text-[10px] text-gray-400">{filteredAdvances.length} {t('dashboard.transactions')}</p>
                                </div>
                            </div>

                            {viewMode === 'period' && (
                                <FilterBar filter={filter} setFilter={setFilter}
                                    from={customFrom} setFrom={setCustomFrom}
                                    to={customTo} setTo={setCustomTo}
                                    onReset={() => setAdvPage(1)} />
                            )}

                            {filteredAdvances.length === 0 ? (
                                <EmptyState icon={<Wallet size={28} />} msg={t('dashboard.noAdvances', { defaultValue: 'No advance transactions' })} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-50">
                                    {pagedAdvances.map((a) => (
                                        <div key={a.id} className="flex items-center justify-between py-2.5">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${a.type === "given" ? "bg-emerald-500" : "bg-red-500"}`}>
                                                    {a.type === "given" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-gray-700 truncate">
                                                        {a.remarks || (a.type === "given" ? t('dashboard.advanceGiven', { defaultValue: 'Advance given' }) : t('dashboard.installmentReceived', { defaultValue: 'Installment received' }))}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400">{fmtDate(a.transaction_date)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs font-bold shrink-0 ml-3 ${a.type === "given" ? "text-emerald-600" : "text-red-500"}`}>
                                                {a.type === "given" ? "+" : "−"}₹{fmt(a.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Paginator total={filteredAdvances.length} page={advPage} setPage={setAdvPage}
                                pageSize={advPageSize} setPageSize={setAdvPageSize} />

                            <div className="mt-2 pt-3 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
                                <span>{t('dashboard.given', { defaultValue: 'Given' })}: <strong className="text-emerald-600">₹{fmt(advGiven)}</strong></span>
                                <span>{t('dashboard.received', { defaultValue: 'Received' })}: <strong className="text-red-500">₹{fmt(advReceived)}</strong></span>
                            </div>
                        </div>

                        {/* Deposit */}
                        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="w-7 h-7 rounded-lg bg-emerald-700 flex items-center justify-center shrink-0">
                                    <PiggyBank size={13} className="text-white" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800 leading-tight">{t('dashboard.deposit', { defaultValue: 'Deposit' })}</p>
                                    <p className="text-[10px] text-gray-400">{filteredDeposits.length} {t('dashboard.transactions')}</p>
                                </div>
                            </div>

                            {viewMode === 'period' && (
                                <FilterBar filter={filter} setFilter={setFilter}
                                    from={customFrom} setFrom={setCustomFrom}
                                    to={customTo} setTo={setCustomTo}
                                    onReset={() => setDepPage(1)} />
                            )}

                            {filteredDeposits.length === 0 ? (
                                <EmptyState icon={<PiggyBank size={28} />} msg={t('dashboard.noDeposits', { defaultValue: 'No deposit activity yet' })} />
                            ) : (
                                <div className="flex flex-col divide-y divide-gray-50">
                                    {pagedDeposits.map((d) => (
                                        <div key={d.id} className="flex items-center justify-between py-2.5">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${d.type === "credit" ? "bg-violet-500" : "bg-gray-400"}`}>
                                                    {d.type === "credit" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-gray-700 truncate">
                                                        {d.remarks || (d.type === "credit" ? t('dashboard.depositAdded', { defaultValue: 'Deposit added' }) : t('dashboard.depositWithdrawn', { defaultValue: 'Deposit withdrawn' }))}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400">{fmtDate(d.transaction_date)}</p>
                                                </div>
                                            </div>
                                            <span className={`text-xs font-bold shrink-0 ml-3 ${d.type === "credit" ? "text-violet-600" : "text-gray-500"}`}>
                                                {d.type === "credit" ? "+" : "−"}₹{fmt(d.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <Paginator total={filteredDeposits.length} page={depPage} setPage={setDepPage}
                                pageSize={depPageSize} setPageSize={setDepPageSize} />

                            <div className="mt-2 pt-3 border-t border-gray-100 flex justify-between text-[11px] text-gray-500">
                                <span>{t('dashboard.added', { defaultValue: 'Added' })}: <strong className="text-violet-600">₹{fmt(depCredit)}</strong></span>
                                <span>{t('dashboard.withdrawn', { defaultValue: 'Withdrawn' })}: <strong className="text-gray-500">₹{fmt(depDebit)}</strong></span>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}