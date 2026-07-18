// src/pages/farmer/FarmerCattleFeed.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Wheat, ChevronRight, AlertTriangle, Hash,
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ── helpers (mirrors FarmerMilkEntries.jsx) ────────────────────────
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
        const raw = e.sale_date;
        const d = raw && raw.length === 10 ? new Date(raw + "T12:00:00") : new Date(raw);
        return (!f || d >= f) && (!tt || d <= tt);
    });
};

// ── Main ────────────────────────────────────────────────────────────
export default function FarmerCattleFeed() {
    const { user } = useAuth();
    const { t } = useTranslation();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Payment Cycle is the priority/default view; Custom Period is optional
    const [viewMode, setViewMode] = useState('cycle'); // 'cycle' | 'period'
    const [selectedDate, setSelectedDate] = useState(today());

    const [filter, setFilter] = useState("month");
    const [customFrom, setCustomFrom] = useState("");
    const [customTo, setCustomTo] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);

    const activeCycle = getActiveFixedCycle(new Date(selectedDate + 'T00:00:00'));

    // Expected shape from GET /api/farmer/cattle-feed (own-seller-only,
    // enforced server-side via requireRole('seller') + WHERE seller_id = req.user.id
    // — mirrors /farmer/milk-entries): flat array of purchase lines, one
    // per feed line, each carrying its transaction_id so lines from the
    // same purchase can be grouped visually.
    const fetchCattleFeed = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/farmer/cattle-feed");
            setRows(data || []);
        } catch {
            setError(t('dashboard.loadFailed', { defaultValue: 'Failed to load cattle feed purchases' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCattleFeed(); }, []);

    useEffect(() => { setPage(1); }, [viewMode, selectedDate, filter, customFrom, customTo]);

    const filtered = viewMode === 'cycle'
        ? rows.filter(e => {
            const raw = e.sale_date;
            const d = raw && raw.length === 10 ? new Date(raw + "T12:00:00") : new Date(raw);
            const s = new Date(activeCycle.from + 'T00:00:00');
            const en = new Date(activeCycle.to + 'T23:59:59');
            return d >= s && d <= en;
        })
        : applyDateFilter(rows, filter, customFrom, customTo);
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

    const totalAmt = filtered.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const totalQty = filtered.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const uniqueTxns = new Set(filtered.map(e => e.transaction_id)).size;
    const uniqueFeeds = new Set(filtered.map(e => e.feed_id)).size;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Breadcrumb + Header */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Link to="/farmer/dashboard" className="hover:text-gray-600 transition">
                        {t('dashboard.myDashboard', { defaultValue: 'My Dashboard' })}
                    </Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-600 font-medium">{t('nav.MyCattleFeed', { defaultValue: 'My Cattle Feed' })}</span>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/farmer/dashboard"
                        className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm shrink-0">
                        <ArrowLeft size={16} />
                    </Link>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-700 flex items-center justify-center shrink-0">
                        <Wheat size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">
                            {t('nav.MyCattleFeed', { defaultValue: 'My Cattle Feed' })}
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
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-amber-100 bg-amber-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 opacity-70">{t('dashboard.totalSpent', { defaultValue: 'Total Spent' })}</p>
                        <p className="text-xl font-bold text-gray-900">₹{fmt(totalAmt)}</p>
                        <p className="text-[10px] text-gray-400">{filtered.length} {t('dashboard.entries', { defaultValue: 'lines' })}</p>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-emerald-100 bg-emerald-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 opacity-70">{t('dashboard.totalQty', { defaultValue: 'Total Quantity' })}</p>
                        <p className="text-xl font-bold text-gray-900">{totalQty.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-indigo-100 bg-indigo-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 opacity-70">{t('dashboard.transactions', { defaultValue: 'Transactions' })}</p>
                        <p className="text-xl font-bold text-gray-900">{uniqueTxns}</p>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-4 rounded-2xl border border-blue-100 bg-blue-50">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 opacity-70">{t('dashboard.feedTypes', { defaultValue: 'Feed Types' })}</p>
                        <p className="text-xl font-bold text-gray-900">{uniqueFeeds}</p>
                    </div>
                </div>

                {/* Current Payment Cycle / Custom Period indicator */}
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
                            <Wheat size={14} className="text-white" />
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
                                    : <>{filtered.length} {t('dashboard.entries', { defaultValue: 'lines' })} {t('dashboard.matchingFilter', { defaultValue: 'matching filter' })}</>}
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

                {/* Purchases table */}
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
                        <EmptyState icon={<Wheat size={28} />} msg={t('dashboard.noCattleFeed', { defaultValue: 'No cattle feed purchases for this period' })} />
                    ) : (
                        <div className="overflow-x-auto -mx-5">
                            <div className="max-h-[520px] overflow-y-auto">
                                <table className="w-full text-sm min-w-max">
                                    <thead className="sticky top-0 z-10 bg-white">
                                        <tr className="border-b border-gray-50">
                                            {["Date", "Transaction", "Feed", "Qty", "Unit", "Rate", "Amount"].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {paginated.map((e) => (
                                            <tr key={e.sale_id} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{fmtDate(e.sale_date)}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-gray-400">
                                                        <Hash size={9} />{e.transaction_id}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 whitespace-nowrap">{e.feed_name}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-700 font-medium">{parseFloat(e.quantity).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 text-xs text-gray-400">{e.unit}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-600">₹{parseFloat(e.rate).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(e.total_amount || 0).toFixed(2)}</td>
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