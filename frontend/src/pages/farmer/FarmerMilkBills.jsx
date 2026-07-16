// src/pages/farmer/FarmerMilkBills.jsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, Receipt, ChevronRight, AlertTriangle, X,
    Milk, FlaskConical, Banknote, Sun, Moon,
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

function StatCard({ label, value, icon, color }) {
    const colors = {
        blue: "text-blue-600 bg-blue-50 border-blue-100",
        emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
        amber: "text-amber-600 bg-amber-50 border-amber-100",
        violet: "text-violet-600 bg-violet-50 border-violet-100",
    };
    return (
        <div className={`flex flex-col gap-1 px-4 py-4 rounded-2xl border ${colors[color]}`}>
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <div className="shrink-0 opacity-80">{icon}</div>
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
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

function FilterBar({ filter, setFilter, from, setFrom, to, setTo, onReset, t }) {
    const presets = ["day", "week", "month", "year", "custom"];
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
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Breadcrumb + Header */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Link to="/farmer/dashboard" className="hover:text-gray-600 transition">
                        {t('dashboard.myDashboard', { defaultValue: 'My Dashboard' })}
                    </Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-600 font-medium">{t('dashboard.myBills', { defaultValue: 'My Bills' })}</span>
                </div>

                <div className="flex items-center gap-4">
                    <Link to="/farmer/dashboard"
                        className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm shrink-0">
                        <ArrowLeft size={16} />
                    </Link>
                    <div className="w-11 h-11 rounded-2xl bg-emerald-700 flex items-center justify-center shrink-0">
                        <Receipt size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 leading-tight">
                            {t('dashboard.myBills', { defaultValue: 'My Bills' })}
                        </h1>
                        <p className="text-xs text-gray-400 mt-0.5">{user?.name}</p>
                    </div>
                </div>

                {error && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium bg-rose-50 border border-rose-200 text-rose-600">
                        <AlertTriangle size={15} /> {error}
                    </div>
                )}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        <AlertTriangle size={15} /> {flash.msg}
                    </div>
                )}

                {/* Stats overview */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard label={t('dashboard.totalBills', { defaultValue: 'Total Bills' })} value={filtered.length} icon={<Receipt size={15} />} color="blue" />
                    <StatCard label={t('dashboard.milkDelivered', { defaultValue: 'Total Qty' })} value={`${totalQty.toFixed(1)} L`} icon={<Milk size={15} />} color="amber" />
                    <StatCard label={t('dashboard.netCashPaid', { defaultValue: 'Total Paid' })} value={`₹${fmt(totalPayable)}`} icon={<Banknote size={15} />} color="emerald" />
                </div>

                {/* Current Payment Cycle / All Bills indicator */}
                <div className="flex items-center justify-between px-5 py-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0">
                            <Receipt size={14} className="text-white" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider">
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
                            <button
                                onClick={() => setViewMode('all')}
                                className={`px-3 py-1.5 transition ${viewMode === 'all' ? "bg-emerald-700 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                            >
                                {t('dashboard.allBills', { defaultValue: 'All Bills' })}
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

                {/* Bills list */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                    {viewMode === 'period' && (
                        <FilterBar filter={periodFilter} setFilter={setPeriodFilter}
                            from={periodFrom} setFrom={setPeriodFrom}
                            to={periodTo} setTo={setPeriodTo}
                            onReset={() => setPage(1)} t={t} />
                    )}

                    {loading ? (
                        <Spinner />
                    ) : filtered.length === 0 ? (
                        <EmptyState icon={<Receipt size={28} />} msg={t('dashboard.noBills', { defaultValue: 'No bills for this period' })} />
                    ) : (
                        <div className="flex flex-col divide-y divide-gray-50">
                            {paginated.map((b) => (
                                <div key={b.bill_id} className="flex items-center justify-between py-3">
                                    <div className="min-w-0">
                                        <button onClick={() => openBillDetail(b.bill_no)}
                                            className="text-sm font-mono font-semibold text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-2 transition">
                                            {b.bill_no}
                                        </button>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {fmtDate(b.from_date)} – {fmtDate(b.to_date)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0 ml-3">
                                        <p className="text-sm font-bold text-emerald-600">₹{fmt(b.final_payable)}</p>
                                        <p className="text-[11px] text-gray-400">{b.total_qty} L · {b.total_entries} {t('dashboard.entries')}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Paginator total={filtered.length} page={page} setPage={setPage}
                        pageSize={pageSize} setPageSize={setPageSize} />
                </div>
            </main>

            {/* Bill Detail Modal */}
            {billModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[85vh] flex flex-col">
                        <div className="flex items-center rounded-2xl justify-between px-6 py-4 border-b border-gray-100 shrink-0 bg-emerald-50">
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

                        <div className="flex-1 overflow-y-auto px-6 py-5">
                            {billDetailLoading ? (
                                <Spinner />
                            ) : !billDetail ? (
                                <EmptyState icon={<Receipt size={28} />} msg={t('dashboard.billLoadFailed', { defaultValue: 'Failed to load bill details' })} />
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