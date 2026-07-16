// src/pages/farmer/FarmerMilkEntries.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Milk, FlaskConical, ChevronRight, AlertTriangle,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";


// ── helpers ───────────────────────────────────────────────────
const fmt = (v) =>
    parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const milkBadge = (t) =>
    t === "cow" ? "bg-amber-50 text-amber-700 border border-amber-100"
        : "bg-blue-50 text-blue-700 border border-blue-100";

const today = () => new Date().toISOString().split("T")[0];

// Fixed monthly payment cycles: 1–10, 11–20, 21–end of month (mirrors SellerPayments.jsx / FarmerDashboard.jsx)
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-50">
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

// ── Main ──────────────────────────────────────────────────────
export default function FarmerMilkEntries() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Payment Cycle is the priority/default view; Custom Period (day/week/month/year/custom) is optional
    const [viewMode, setViewMode] = useState('cycle'); // 'cycle' | 'period'
    const [selectedDate, setSelectedDate] = useState(today());

    const [filter, setFilter] = useState("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const activeCycle = getActiveFixedCycle(new Date(selectedDate + 'T00:00:00'));

    const applyDateFilter = (list, filter, from, to) => {
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
            const raw = e.entry_date;
            const d = raw && raw.length === 10 ? new Date(raw + "T12:00:00") : new Date(raw);
            return (!f || d >= f) && (!tt || d <= tt);
        });
    };

    const fetchEntries = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/farmer/milk-entries");
            setEntries(data || []);
        } catch {
            setError(t('dashboard.loadFailed', { defaultValue: 'Failed to load milk entries' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchEntries(); }, []);

    useEffect(() => { setPage(1); }, [viewMode, selectedDate, filter, customFrom, customTo]);
    
    const filtered = viewMode === 'cycle'
        ? entries.filter(e => {
            const raw = e.entry_date;
            const d = raw && raw.length === 10 ? new Date(raw + "T12:00:00") : new Date(raw);
            const s = new Date(activeCycle.from + 'T00:00:00');
            const en = new Date(activeCycle.to + 'T23:59:59');
            return d >= s && d <= en;
        })
        : applyDateFilter(entries, filter, customFrom, customTo);
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const totalQty = filtered.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalAmt = filtered.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const avgFat = filtered.length ? (filtered.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / filtered.length).toFixed(2) : "0.00";
    const avgSnf = filtered.length ? (filtered.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / filtered.length).toFixed(2) : "0.00";
    const cowQty = filtered.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const bufQty = filtered.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Breadcrumb + Header */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Link to="/farmer/dashboard" className="hover:text-gray-600 transition">
                        {t('dashboard.myDashboard', { defaultValue: 'My Dashboard' })}
                    </Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-600 font-medium">{t('dashboard.myMilkEntries', { defaultValue: 'My Milk Entries' })}</span>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/farmer/dashboard"
                        className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm shrink-0">
                        <ArrowLeft size={16} />
                    </Link>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-700 flex items-center justify-center shrink-0">
                        <Milk size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">
                            {t('dashboard.myMilkEntries', { defaultValue: 'My Milk Entries' })}
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">{user?.name}</p>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium bg-rose-50 border border-rose-200 text-rose-600">
                        <AlertTriangle size={15} /> {error}
                    </div>
                )}

                {/* Stats overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-blue-100 bg-blue-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 opacity-70">{t('dashboard.milkDelivered', { defaultValue: 'Total Delivered' })}</p>
                        <p className="text-xl font-bold text-gray-900">{totalQty.toFixed(1)} L</p>
                        <p className="text-[10px] text-gray-400">{filtered.length} {t('dashboard.entries')}</p>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-emerald-100 bg-emerald-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 opacity-70">{t('dashboard.milkEarnings', { defaultValue: 'Total Earnings' })}</p>
                        <p className="text-xl font-bold text-gray-900">₹{fmt(totalAmt)}</p>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-indigo-100 bg-indigo-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 opacity-70">{t('dashboard.avgFatSnf', { defaultValue: 'Avg FAT / SNF' })}</p>
                        <p className="text-xl font-bold text-gray-900">{avgFat} / {avgSnf}</p>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-amber-100 bg-amber-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 opacity-70">{t('dashboard.cow', { defaultValue: 'Cow' })} / {t('dashboard.buffalo', { defaultValue: 'Buffalo' })}</p>
                        <p className="text-xl font-bold text-gray-900">{cowQty.toFixed(1)} / {bufQty.toFixed(1)} L</p>
                    </div>
                </div>

                {/* Current Payment Cycle / Custom Period indicator */}
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
                            <Milk size={14} className="text-white" />
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
                                    : <>{filtered.length} {t('dashboard.entries')} {t('dashboard.matchingFilter', { defaultValue: 'matching filter' })}</>}
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

                {/* Entries table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    {viewMode === 'period' && (
                        <FilterBar filter={filter} setFilter={setFilter}
                            from={customFrom} setFrom={setCustomFrom}
                            to={customTo} setTo={setCustomTo}
                            onReset={() => setPage(1)} />
                    )}

                    {loading ? (
                        <Spinner />
                    ) : filtered.length === 0 ? (
                        <EmptyState icon={<Milk size={28} />} msg={t('dashboard.noMilkEntries', { defaultValue: 'No milk entries for this period' })} />
                    ) : (
                        <div className="overflow-x-auto -mx-5">
                            <div className="max-h-[520px] overflow-y-auto">
                                <table className="w-full text-sm min-w-max">
                                    <thead className="sticky top-0 z-10 bg-white">
                                        <tr className="border-b border-gray-50">
                                            {["Date", "Shift", "Milk", "Qty (L)", "FAT", "SNF", "Water%", "Rate", "Amount", "Premium"].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {paginated.map((e) => (
                                            <tr key={e.entry_id} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{fmtDate(e.entry_date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.shift === "morning" ? "bg-yellow-50 text-yellow-700 border border-yellow-100" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                                                        {e.shift}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${milkBadge(e.milk_type)}`}>{e.milk_type}</span>
                                                </td>
                                                <td className="px-4 py-2.5 font-mono text-gray-700 font-medium">{parseFloat(e.quantity).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-mono text-blue-600">{parseFloat(e.fat).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-mono text-emerald-600">{parseFloat(e.snf).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-500">{parseFloat(e.water || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-600">₹{parseFloat(e.rate_applied || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(e.total_amount || 0).toFixed(2)}</td>
                                                <td className="px-4 py-2.5">
                                                    {e.is_premium
                                                        ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Premium</span>
                                                        : <span className="text-gray-300 text-xs">—</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <Paginator total={filtered.length} page={page} setPage={setPage}
                        pageSize={pageSize} setPageSize={setPageSize} />
                </div>
            </main>
        </div>
    );
}