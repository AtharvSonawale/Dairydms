// src/pages/farmer/FarmerMilkBills.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Receipt, ChevronRight, AlertTriangle, X,
    Milk, FlaskConical, Banknote, Sun, Moon, Home,
    BadgeCheck, Calendar, Droplets
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ── helpers ───────────────────────────────────────────────────
const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const today = () => new Date().toISOString().split("T")[0];

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
    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);
    const cycles = getFixedMonthCycles(today);
    return cycles.find(c => {
        const s = new Date(c.from + 'T00:00:00');
        const e = new Date(c.to + 'T00:00:00');
        return today >= s && today <= e;
    }) || cycles[0];
};

// ── sub-components ───────────────────────────────────────────
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

function MilkTypeBadge({ type }) {
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm
            ${type === "cow"
                ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                : "bg-slate-100/80 text-slate-700 border-slate-200/60"}`}>
            {type === "cow" ? "Cow" : "Buffalo"}
        </span>
    );
}

function StatCard({ label, value, icon, color }) {
    const colorMap = {
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        violet: "from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700",
        gray: "from-gray-50 to-gray-100/50 border-gray-200/60 text-gray-700",
    };

    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${colorMap[color] || colorMap.gray} shadow-sm p-4 flex items-center gap-3`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">{icon}</div>
            <div className="relative z-10 min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-1">{value}</p>
            </div>
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

function FilterBar({ filter, setFilter, from, setFrom, to, setTo, onReset, t }) {
    const presets = ["day", "week", "month", "year", "custom"];
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

// Applies a day/week/month/year/custom filter against a bill's to_date
const applyBillDateFilter = (list, filter, customFrom, customTo) => {
    const now = new Date();
    let from, to;
    if (filter === "custom") {
        from = customFrom ? new Date(customFrom) : null;
        to = customTo ? new Date(customTo + "T23:59:59") : null;
    } else if (filter === "day") {
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    } else if (filter === "week") {
        const day = now.getDay();
        from = new Date(now); from.setDate(now.getDate() - day);
        to = new Date(now);
    } else if (filter === "month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (filter === "year") {
        from = new Date(now.getFullYear(), 0, 1);
        to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    } else {
        return list;
    }
    return list.filter(b => {
        const d = new Date(b.to_date + "T12:00:00");
        return (!from || d >= from) && (!to || d <= to);
    });
};

// ── Main ──────────────────────────────────────────────────────
export default function FarmerMilkBills() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const [bills, setBills] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [flash, setFlash] = useState(null);

    // Payment Cycle is the priority/default view; Custom Period and All Bills are optional
    const [viewMode, setViewMode] = useState('cycle'); // 'cycle' | 'period' | 'all'
    const [selectedDate, setSelectedDate] = useState(today());
    const [periodFilter, setPeriodFilter] = useState('month');
    const [periodFrom, setPeriodFrom] = useState('');
    const [periodTo, setPeriodTo] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const activeCycle = getActiveFixedCycle(new Date(selectedDate + 'T00:00:00'));

    const [billModalOpen, setBillModalOpen] = useState(false);
    const [billDetail, setBillDetail] = useState(null);
    const [billDetailLoading, setBillDetailLoading] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchBills = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/farmer/bills");
            setBills(data || []);
        } catch {
            setError(t('dashboard.loadFailed', { defaultValue: 'Failed to load bills' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBills(); }, []);
    useEffect(() => { setPage(1); }, [viewMode, selectedDate, periodFilter, periodFrom, periodTo]);

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

    const filtered = viewMode === 'cycle'
        ? bills.filter(b => {
            const from = new Date(b.from_date);
            const to = new Date(b.to_date);
            const s = new Date(activeCycle.from + 'T00:00:00');
            const e = new Date(activeCycle.to + 'T23:59:59');
            return from <= e && to >= s;
        })
        : viewMode === 'period'
            ? applyBillDateFilter(bills, periodFilter, periodFrom, periodTo)
            : bills;

    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const totalPayable = filtered.reduce((a, b) => a + parseFloat(b.final_payable || 0), 0);
    const totalQty = filtered.reduce((a, b) => a + parseFloat(b.total_qty || 0), 0);
    const totalEntries = filtered.reduce((a, b) => a + parseInt(b.total_entries || 0), 0);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('dashboard.myBills', { defaultValue: 'My Bills' })}
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

                {/* ── Stats overview ── */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Droplets size={14} /> {t('dashboard.myOverview', { defaultValue: 'My Overview' })}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <StatCard
                            label={t('dashboard.totalBills', { defaultValue: 'Total Bills' })}
                            value={filtered.length}
                            icon={<Receipt size={16} />}
                            color="blue"
                        />
                        <StatCard
                            label={t('dashboard.milkDelivered', { defaultValue: 'Total Qty' })}
                            value={`${totalQty.toFixed(1)} L`}
                            icon={<Milk size={16} />}
                            color="amber"
                        />
                        <StatCard
                            label={t('dashboard.netCashPaid', { defaultValue: 'Total Paid' })}
                            value={`₹${fmt(totalPayable)}`}
                            icon={<Banknote size={16} />}
                            color="emerald"
                        />
                    </div>
                </div>

                {/* ── Current Payment Cycle / All Bills indicator ── */}
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
                                        : viewMode === 'period'
                                            ? t('dashboard.customPeriodViewing', { defaultValue: 'Viewing Custom Period' })
                                            : t('dashboard.allBills', { defaultValue: 'All Bills' })}
                                </p>
                                <p className="text-sm font-bold text-gray-900 leading-tight">
                                    {viewMode === 'cycle'
                                        ? <>{activeCycle.label} <span className="font-normal text-gray-400">·</span> {fmtDate(activeCycle.from)} – {fmtDate(activeCycle.to)}</>
                                        : <>{filtered.length} {t('dashboard.total', { defaultValue: 'total' })}</>}
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
                                <button
                                    onClick={() => setViewMode('all')}
                                    className={`px-3.5 py-2 transition-all duration-200 ${viewMode === 'all' ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "bg-white/50 text-gray-600 hover:bg-gray-100/50"}`}
                                >
                                    {t('dashboard.allBills', { defaultValue: 'All Bills' })}
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

                {/* ── Bills list ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        {viewMode === 'period' && (
                            <FilterBar filter={periodFilter} setFilter={setPeriodFilter}
                                from={periodFrom} setFrom={setPeriodFrom}
                                to={periodTo} setTo={setPeriodTo}
                                onReset={() => setPage(1)} t={t} />
                        )}

                        {loading ? (
                            <Spinner />
                        ) : filtered.length === 0 ? (
                            <EmptyState icon={<Receipt size={32} />} msg={t('dashboard.noBills', { defaultValue: 'No bills for this period' })} />
                        ) : (
                            <div className="flex flex-col divide-y divide-gray-100/60">
                                {paginated.map((b) => (
                                    <div key={b.bill_id} className="flex items-center justify-between py-2.5 hover:bg-gray-50/30 -mx-1 px-1 rounded-lg transition">
                                        <div className="min-w-0">
                                            <button
                                                onClick={() => openBillDetail(b.bill_no)}
                                                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline underline-offset-2 transition"
                                            >
                                                {b.bill_no}
                                            </button>
                                            <p className="text-[10px] text-gray-400 mt-0.5">
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
                        <Paginator total={filtered.length} page={page} setPage={setPage}
                            pageSize={pageSize} setPageSize={setPageSize} />
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-600">{viewMode === 'cycle' ? activeCycle.label : viewMode === 'period' ? periodFilter : 'All'}</strong> {t('dashboard.footerData')}</span>
                    <span>· {t('dashboard.farmerFooter', { defaultValue: 'Showing only your own records' })}</span>
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
                                <EmptyState icon={<Receipt size={32} />} msg={t('dashboard.billLoadFailed', { defaultValue: 'Failed to load bill details' })} />
                            ) : (
                                <div className="flex flex-col gap-5">
                                    {/* Summary cards */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <StatCard
                                            label={t('dashboard.milkAmount', { defaultValue: 'Milk Amount' })}
                                            value={`₹${fmt(billDetail.payment.milk_amount)}`}
                                            icon={<Milk size={14} />}
                                            color="emerald"
                                        />
                                        <StatCard
                                            label={t('dashboard.total', { defaultValue: 'Total' }) + ' ' + t('dashboard.entries')}
                                            value={billDetail.entries.length}
                                            icon={<Receipt size={14} />}
                                            color="blue"
                                        />
                                        <StatCard
                                            label={t('dashboard.totalQty', { defaultValue: 'Total Qty' })}
                                            value={`${billDetail.entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L`}
                                            icon={<FlaskConical size={14} />}
                                            color="amber"
                                        />
                                        <StatCard
                                            label={t('dashboard.netCashPaid', { defaultValue: 'Net Cash Paid' })}
                                            value={`₹${fmt(billDetail.payment.cash_paid)}`}
                                            icon={<Banknote size={14} />}
                                            color="violet"
                                        />
                                    </div>

                                    {/* Milk entries table */}
                                    <div>
                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Milk size={12} /> {t('dashboard.milkCollectionEntries', { defaultValue: 'Milk Collection Entries' })} ({billDetail.entries.length})
                                        </p>
                                        <div className="rounded-xl border border-gray-200/60 overflow-x-auto shadow-sm">
                                            <table className="w-full text-xs min-w-max">
                                                <thead className="bg-gradient-to-r from-gray-50/50 to-white/50">
                                                    <tr>
                                                        {[t('bill.date', { defaultValue: 'Date' }), t('bill.shift'), t('dashboard.milkType', { defaultValue: 'Type' }), t('dashboard.qty', { defaultValue: 'Qty (L)' }), t('bill.fat'), t('bill.snf'), t('bill.rate', { defaultValue: 'Rate' }), t('bill.amount')].map(h => (
                                                            <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-200/60 last:border-r-0">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100/60">
                                                    {billDetail.entries.map((e, i) => (
                                                        <tr key={i} className="hover:bg-gray-50/30 transition">
                                                            <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap border-r border-gray-200/60">{fmtDate(e.entry_date)}</td>
                                                            <td className="px-3 py-2.5 border-r border-gray-200/60"><ShiftBadge shift={e.shift} t={t} /></td>
                                                            <td className="px-3 py-2.5 border-r border-gray-200/60"><MilkTypeBadge type={e.milk_type} /></td>
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
                                            <Banknote size={12} /> {t('dashboard.paymentBreakdown', { defaultValue: 'Payment Breakdown' })}
                                        </p>
                                        <div className="rounded-xl border border-gray-200/60 overflow-hidden shadow-sm">
                                            {[
                                                { label: t('dashboard.milkAmountPayable', { defaultValue: 'Milk Amount Payable' }), value: billDetail.payment.milk_amount, sign: "+", color: "bg-emerald-50/80 text-emerald-700" },
                                                { label: t('dashboard.advanceOutstanding', { defaultValue: 'Advance Outstanding' }), value: billDetail.payment.advance_given, sign: "", color: "bg-violet-50/80 text-violet-700", skipIfZero: true },
                                                { label: t('dashboard.advInstallmentCut', { defaultValue: 'Advance Installment Cut' }), value: billDetail.payment.installment_cut, sign: "−", color: "bg-rose-50/80 text-rose-700", skipIfZero: true },
                                                { label: t('dashboard.depositDeducted', { defaultValue: 'Deposit Deducted' }), value: billDetail.payment.deposit_amount, sign: "−", color: "bg-blue-50/80 text-blue-700", skipIfZero: true },
                                                { label: t('dashboard.productSalesDeduction', { defaultValue: 'Product Sales Deduction' }), value: billDetail.payment.product_deduction, sign: "−", color: "bg-amber-50/80 text-amber-700", skipIfZero: true },
                                                { label: t('dashboard.milkBoughtDeduction', { defaultValue: 'Milk Bought (Walk-in)' }), value: billDetail.payment.walkin_deduction, sign: "−", color: "bg-orange-50/80 text-orange-700", skipIfZero: true },
                                            ].filter(row => !row.skipIfZero || parseFloat(row.value || 0) > 0).map((row, i) => (
                                                <div key={i} className={`flex items-center justify-between px-4 py-2.5 border-b border-gray-200/60 last:border-0 ${row.color} backdrop-blur-sm`}>
                                                    <span className="text-xs font-medium">{row.label}</span>
                                                    <span className="text-xs font-bold font-mono">{row.sign} ₹{fmt(row.value)}</span>
                                                </div>
                                            ))}
                                            <div className="flex items-center justify-between px-4 py-3.5 bg-gradient-to-br from-gray-900 to-gray-800 text-white">
                                                <span className="text-xs font-bold uppercase tracking-wider">{t('dashboard.netCashToHand', { defaultValue: 'Net Cash To Hand' })}</span>
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
                                                <ShoppingBag size={12} /> {t('dashboard.myProductPurchases', { defaultValue: 'Product Purchases' })} ({billDetail.productSales.length})
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