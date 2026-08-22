// src/pages/farmer/FarmerProductSales.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, ShoppingBag, ChevronRight, AlertTriangle, Hash,
    Home, Package, Droplets, BadgeCheck, X, Calendar
} from "lucide-react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";

// ── helpers (mirrors FarmerCattleFeed.jsx / FarmerMilkEntries.jsx) ─────
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
        amber: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700",
        emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700",
        indigo: "from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700",
        blue: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700",
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

// Shared date-filter logic (mirrors FarmerMilkEntries.jsx / FarmerCattleFeed.jsx)
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
export default function FarmerProductSales() {
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

    // Expected shape from GET /api/farmer/product-sales (own-seller-only,
    // enforced server-side via requireRole('seller') + WHERE seller_id = req.user.id
    // — mirrors /farmer/cattle-feed): flat array of purchase lines, one per
    // product line, each carrying its transaction_id so lines from the same
    // purchase can be visually grouped.
    const fetchProductSales = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await api.get("/farmer/product-sales");
            setRows(data || []);
        } catch {
            setError(t('dashboard.loadFailed', { defaultValue: 'Failed to load product purchases' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProductSales(); }, []);

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
    const uniqueProducts = new Set(filtered.map(e => e.product_id)).size;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-5 py-4">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('dashboard.myProductPurchases', { defaultValue: 'My Product Purchases' })}
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

                {/* ── Stats overview ── */}
                <div>
                    <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Droplets size={14} /> {t('dashboard.myOverview', { defaultValue: 'My Overview' })}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard
                            label={t('dashboard.totalSpent', { defaultValue: 'Total Spent' })}
                            value={"₹" + fmt(totalAmt)}
                            sub={`${filtered.length} ${t('dashboard.entries', { defaultValue: 'lines' })}`}
                            icon={<Package size={16} />}
                            color="amber"
                        />
                        <StatCard
                            label={t('dashboard.totalQty', { defaultValue: 'Total Quantity' })}
                            value={totalQty.toFixed(2)}
                            icon={<ShoppingBag size={16} />}
                            color="emerald"
                        />
                        <StatCard
                            label={t('dashboard.transactions', { defaultValue: 'Transactions' })}
                            value={uniqueTxns}
                            icon={<Hash size={16} />}
                            color="indigo"
                        />
                        <StatCard
                            label={t('dashboard.productTypes', { defaultValue: 'Products' })}
                            value={uniqueProducts}
                            icon={<Package size={16} />}
                            color="blue"
                        />
                    </div>
                </div>

                {/* ── Current Payment Cycle / Custom Period indicator ── */}
                <div className="relative overflow-hidden rounded-2xl border border-violet-200/60 bg-violet-50/80 backdrop-blur-sm shadow-lg shadow-violet-200/50 px-5 py-4">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-violet-400/5 blur-3xl" />
                    <div className="flex flex-wrap items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/30 shrink-0">
                                <Calendar size={16} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">
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

                {/* ── Purchases table ── */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="relative z-10">
                        {viewMode === 'period' && (
                            <FilterBar filter={filter} setFilter={setFilter}
                                from={customFrom} setFrom={setCustomFrom}
                                to={customTo} setTo={setCustomTo}
                                onReset={() => setPage(1)} />
                        )}

                        {loading ? (
                            <Spinner />
                        ) : filtered.length === 0 ? (
                            <EmptyState icon={<ShoppingBag size={32} />} msg={t('dashboard.noProductPurchases', { defaultValue: 'No product purchases for this period' })} />
                        ) : (
                            <div className="overflow-x-auto -mx-1">
                                <div className="max-h-[520px] overflow-y-auto">
                                    <table className="w-full text-sm min-w-max">
                                        <thead className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm shadow-sm">
                                            <tr className="border-b border-gray-200/60 bg-gradient-to-r from-violet-50/50 to-white/50">
                                                {["Date", "Transaction", "Product", "Qty", "Unit", "Rate", "Amount"].map(h => (
                                                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap border-r border-gray-200/60 last:border-r-0">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100/60">
                                            {paginated.map((e) => (
                                                <tr key={e.sale_id} className="hover:bg-violet-50/20 transition">
                                                    <td className="px-4 py-2.5 text-xs text-gray-600 font-mono whitespace-nowrap border-r border-gray-200/60">{fmtDate(e.sale_date)}</td>
                                                    <td className="px-4 py-2.5 border-r border-gray-200/60">
                                                        <span className="inline-flex items-center gap-1.5 text-[10px] font-mono text-gray-400 bg-gray-50/80 border border-gray-200/60 px-2 py-0.5 rounded-md backdrop-blur-sm">
                                                            <Hash size={9} />{e.transaction_id}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-800 whitespace-nowrap border-r border-gray-200/60">{e.product_name}</td>
                                                    <td className="px-4 py-2.5 font-mono text-violet-600 font-semibold border-r border-gray-200/60">{parseFloat(e.quantity).toFixed(2)}</td>
                                                    <td className="px-4 py-2.5 text-xs text-gray-400 border-r border-gray-200/60">{e.unit}</td>
                                                    <td className="px-4 py-2.5 font-mono text-gray-600 border-r border-gray-200/60">₹{parseFloat(e.rate).toFixed(2)}</td>
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
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('dashboard.footerPeriod')} <strong className="text-gray-600">{viewMode === 'cycle' ? activeCycle.label : filter}</strong> {t('dashboard.footerData')}: {viewMode === 'cycle' ? `${fmtDate(activeCycle.from)} – ${fmtDate(activeCycle.to)}` : `${fmtDate(customFrom) || 'start'} – ${fmtDate(customTo) || 'end'}`}</span>
                    <span>· {t('dashboard.farmerFooter', { defaultValue: 'Showing only your own records' })}</span>
                </div>

            </main>
        </div>
    );
}