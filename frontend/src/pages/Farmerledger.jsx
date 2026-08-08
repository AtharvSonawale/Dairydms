import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    BookOpen, Search, RefreshCw, Wallet, Banknote, User, Receipt,
} from "lucide-react";

import api from "../api/axios";
import { usePermission } from "../context/PermissionContext";
import AccessDenied from "../components/AccessDenied";

// Helper: format currency
const fmt = (n) => n === null || n === undefined ? "—" : `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const iso = (d) => d.toISOString().split("T")[0];
function rangeFor(preset) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const to = new Date(today);
    let from = new Date(today);
    if (preset === "day") { /* from = to = today */ }
    else if (preset === "week") { from.setDate(from.getDate() - 6); }
    else if (preset === "month") { from = new Date(today.getFullYear(), today.getMonth(), 1); }
    else if (preset === "year") { from = new Date(today.getFullYear(), 0, 1); }
    return { from: iso(from), to: iso(to) };
}

// Summary stat card – localized labels are passed via props
function StatCard({ label, value, icon, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

// Balance chip – uses translation for "—" fallback
function BalanceChip({ value }) {
    const { t } = useTranslation();
    const v = parseFloat(value || 0);
    const positive = v > 0;
    const zero = v === 0;
    const display = v === 0 ? t('farmerLedger.zeroBalance', '—') : fmt(v);
    return (
        <span className={`font-mono text-xs font-bold ${zero ? "text-gray-400" : positive ? "text-rose-600" : "text-emerald-600"}`}>
            {display}
        </span>
    );
}

export default function FarmerLedger() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(25);
    const [preset, setPreset] = useState("month");
    const [fromDate, setFromDate] = useState(() => rangeFor("month").from);
    const [toDate, setToDate] = useState(() => rangeFor("month").to);

    const [data, setData] = useState({
        rows: [], total: 0, total_advance_outstanding: 0, total_deposit_held: 0,
    });
    const [loading, setLoading] = useState(false);

    const fetchSummary = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            params.set("page", page);
            params.set("limit", limit);
            params.set("from", fromDate);
            params.set("to", toDate);

            const { data } = await api.get(`/ledger/summary?${params.toString()}`);
            setData(data);
        } catch (err) {
            console.error("Failed to load farmer summary:", err);
        } finally {
            setLoading(false);
        }
    }, [search, page, limit, fromDate, toDate]);

    useEffect(() => { fetchSummary(); }, [fetchSummary]);
    // Reset to page 1 when filters change
    useEffect(() => { setPage(1); }, [search, fromDate, toDate]);
    const totalPages = Math.ceil((data.total || 0) / limit);

    const selectPreset = (p) => {
        setPreset(p);
        setPage(1); // Reset to first page on filter change
        if (p !== "custom") {
            const r = rangeFor(p);
            setFromDate(r.from);
            setToDate(r.to);
        }
    };

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('seller_payments', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <BookOpen size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('farmerLedger.title')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">{t('farmerLedger.subtitle')}</p>
                        </div>
                    </div>
                    <button onClick={() => { setPage(1); fetchSummary(); }}
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                            bg-gray-100 text-gray-600 hover:bg-gray-200 transition self-start sm:self-auto">
                        <RefreshCw size={13} /> {t('farmerLedger.refresh')}
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
                    <StatCard
                        label={t('farmerLedger.stats.advanceOutstanding')}
                        value={fmt(data.total_advance_outstanding)}
                        icon={<Banknote size={16} />}
                        color="text-violet-600 bg-violet-50 border-violet-100"
                    />
                    <StatCard
                        label={t('farmerLedger.stats.depositHeld')}
                        value={fmt(data.total_deposit_held)}
                        icon={<Wallet size={16} />}
                        color="text-blue-600 bg-blue-50 border-blue-100"
                    />
                </div>

                {/* Date filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["custom", "Custom"]].map(([v, l]) => (
                            <button key={v} onClick={() => selectPreset(v)}
                                className={`px-3 py-2 transition ${preset === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                    <input type="date" value={fromDate} disabled={preset !== "custom"}
                        onChange={e => { setFromDate(e.target.value); setPage(1); }}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                            focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="date" value={toDate} disabled={preset !== "custom"}
                        onChange={e => { setToDate(e.target.value); setPage(1); }}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                            focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                </div>

                {/* Search */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[220px] max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                            value={search}
                            onChange={e => { setPage(1); setSearch(e.target.value); }}
                            placeholder={t('farmerLedger.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300"
                        />
                    </div>
                    {search && (
                        <button onClick={() => { setSearch(""); setPage(1); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 bg-white transition">
                            {t('farmerLedger.clear')}
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.farmerId')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.farmerName')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-violet-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.advanceCredit')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-violet-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.advanceDebit')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-violet-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.advanceBalance')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-blue-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.depositCredit')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-blue-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.depositDebit')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-blue-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.depositBalance')}
                                    </th>
                                    <th className="px-4 py-3 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.lastBillAmount')}
                                    </th>
                                    <th className="px-4 py-3 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                                        {t('farmerLedger.table.lastBillDate')}
                                    </th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan={11} className="py-16 text-center">
                                        <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
                                    </td></tr>
                                ) : data.rows.length === 0 ? (
                                    <tr><td colSpan={11} className="py-16 text-center text-gray-300">
                                        <BookOpen size={28} className="mx-auto mb-2" />
                                        <p className="text-sm">{t('farmerLedger.noFarmers')}</p>
                                    </td></tr>
                                ) : data.rows.map((r) => (
                                    <tr key={r.seller_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition">
                                        {/* Farmer ID */}
                                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-gray-500">
                                            {r.seller_code}
                                        </td>

                                        {/* Farmer Name (linked to detail) */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Link to={`/farmer-ledger/${r.seller_id}`}
                                                className="inline-flex items-center gap-1.5 font-semibold text-violet-700 hover:text-violet-900 hover:underline">
                                                <User size={12} /> {r.name}
                                            </Link>
                                        </td>

                                        {/* Advance columns */}
                                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-600 whitespace-nowrap">
                                            {fmt(r.advance_credit)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-600 whitespace-nowrap">
                                            {fmt(r.advance_debit)}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <BalanceChip value={r.advance_balance} />
                                        </td>

                                        {/* Deposit columns */}
                                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-600 whitespace-nowrap">
                                            {fmt(r.deposit_credit)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-600 whitespace-nowrap">
                                            {fmt(r.deposit_debit)}
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <BalanceChip value={r.deposit_balance} />
                                        </td>

                                        {/* Last bill */}
                                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                                            {r.last_bill_no ? fmt(r.last_bill_cash_paid) : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                                            {r.last_bill_no ? (
                                                <span className="inline-flex items-center gap-1">
                                                    <Receipt size={10} /> {fmtDate(r.last_bill_paid_at)}
                                                </span>
                                            ) : t('farmerLedger.noBillYet')}
                                        </td>

                                        {/* View link */}
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Link to={`/farmer-ledger/${r.seller_id}`}
                                                className="text-[11px] font-semibold text-gray-400 hover:text-gray-700 transition">
                                                {t('farmerLedger.view')} →
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data.total > 0 && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                            <span className="text-xs text-gray-400">
                                {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} {t('farmerLedger.of')} {data.total} {t('farmerLedger.farmers')}
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                    {t('farmerLedger.prev')}
                                </button>
                                <span className="text-xs text-gray-500">
                                    {t('farmerLedger.page')} {page} {t('farmerLedger.of')} {totalPages || 1}
                                </span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                    {t('farmerLedger.next')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}