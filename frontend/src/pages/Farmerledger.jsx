import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    BookOpen, Search, RefreshCw, ChevronDown, ChevronUp,
    ArrowUpCircle, ArrowDownCircle, Wallet, Hash, User,
} from "lucide-react";

import api from "../api/axios";
import { usePermission } from "../context/PermissionContext";
import AccessDenied from "../components/AccessDenied";

const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

const TYPE_OPTIONS = [
    { value: "", label: "All Types" },
    { value: "milk_sale", label: "Milk Sale" },
    { value: "advance_given", label: "Advance Given" },
    { value: "advance_repayment", label: "Advance Repayment" },
    { value: "advance_recovered", label: "Advance Installment Recovered" },
    { value: "deposit_held", label: "Deposit Held" },
    { value: "deposit_refund", label: "Deposit Refunded" },
    { value: "product_purchase", label: "Product Purchase" },
    { value: "cattle_feed_purchase", label: "Cattle Feed Purchase" },
    { value: "walkin_purchase", label: "Milk Purchase (Walk-in)" },
    { value: "cash_paid", label: "Payment Settled" },
];

const TYPE_STYLE = {
    milk_sale: "bg-emerald-50 text-emerald-700 border-emerald-100",
    advance_given: "bg-violet-50 text-violet-700 border-violet-100",
    advance_repayment: "bg-violet-50 text-violet-700 border-violet-100",
    advance_recovered: "bg-rose-50 text-rose-700 border-rose-100",
    deposit_held: "bg-blue-50 text-blue-700 border-blue-100",
    deposit_refund: "bg-blue-50 text-blue-700 border-blue-100",
    product_purchase: "bg-amber-50 text-amber-700 border-amber-100",
    cattle_feed_purchase: "bg-emerald-50 text-emerald-700 border-emerald-100",
    walkin_purchase: "bg-orange-50 text-orange-700 border-orange-100",
    cash_paid: "bg-gray-900 text-white border-gray-900",
};

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

export default function FarmerLedger() {
    const { can, loading: permLoading } = usePermission();

    const [search, setSearch] = useState("");
    const [type, setType] = useState("");
    const [from, setFrom] = useState("");
    const [to, setTo] = useState("");
    const [page, setPage] = useState(1);
    const [limit] = useState(25);

    const [data, setData] = useState({ rows: [], total: 0, total_credit: 0, total_debit: 0, closing_balance: 0 });
    const [loading, setLoading] = useState(false);

    const fetchLedger = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (type) params.set("type", type);
            if (from) params.set("from", from);
            if (to) params.set("to", to);
            params.set("page", page);
            params.set("limit", limit);

            const { data } = await api.get(`/ledger?${params.toString()}`);
            setData(data);
        } catch (err) {
            console.error("Failed to load ledger:", err);
        } finally {
            setLoading(false);
        }
    }, [search, type, from, to, page, limit]);

    useEffect(() => { fetchLedger(); }, [fetchLedger]);

    const totalPages = Math.ceil((data.total || 0) / limit);

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('seller_payments', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <BookOpen size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">Farmer Ledger</h1>
                            <p className="text-xs text-gray-400 mt-0.5">Every credit and debit across all farmers, in one running account</p>
                        </div>
                    </div>
                    <button onClick={() => { setPage(1); fetchLedger(); }}
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                            bg-gray-100 text-gray-600 hover:bg-gray-200 transition self-start sm:self-auto">
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard label="Total Credit (period)" value={fmt(data.total_credit)}
                        icon={<ArrowUpCircle size={16} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                    <StatCard label="Total Debit (period)" value={fmt(data.total_debit)}
                        icon={<ArrowDownCircle size={16} />} color="text-rose-600 bg-rose-50 border-rose-100" />
                    <StatCard label="Net Balance" value={fmt((data.total_credit || 0) - (data.total_debit || 0))}
                        icon={<Wallet size={16} />} color="text-violet-600 bg-violet-50 border-violet-100" />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[220px] max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
                            placeholder="Search farmer, code, reference…"
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <select value={type} onChange={e => { setPage(1); setType(e.target.value); }}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                            focus:outline-none focus:ring-2 focus:ring-black transition">
                        {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <div className="flex items-center gap-2">
                        <input type="date" value={from} onChange={e => { setPage(1); setFrom(e.target.value); }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                        <span className="text-xs text-gray-400">to</span>
                        <input type="date" value={to} onChange={e => { setPage(1); setTo(e.target.value); }}
                            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition" />
                    </div>
                    {(search || type || from || to) && (
                        <button onClick={() => { setSearch(""); setType(""); setFrom(""); setTo(""); setPage(1); }}
                            className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 bg-white transition">
                            Clear filters
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    {["Farmer ID", "Name", "Date & Time", "Type", "Description", "Debit", "Credit", "Running Balance", "Payment Mode", "Reference", "Operator"].map(h => (
                                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                    ))}
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
                                        <p className="text-sm">No ledger entries found for this filter.</p>
                                    </td></tr>
                                ) : data.rows.map((r, i) => (
                                    <tr key={`${r.reference_no}-${r.type}-${i}`}
                                        className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition">
                                        <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{r.seller_code}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <Link to={`/farmer-ledger/${r.seller_id}`}
                                                className="inline-flex items-center gap-1.5 font-semibold text-violet-700 hover:text-violet-900 hover:underline">
                                                <User size={12} /> {r.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(r.ts)}</td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-block text-[10px] font-semibold px-2 py-1 rounded-full border ${TYPE_STYLE[r.type] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
                                                {r.type_label}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-600 max-w-xs truncate" title={r.description}>{r.description}</td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-rose-600 whitespace-nowrap">
                                            {r.debit > 0 ? fmt(r.debit) : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 whitespace-nowrap">
                                            {r.credit > 0 ? fmt(r.credit) : "—"}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">
                                            {fmt(r.running_balance)}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.payment_mode}</td>
                                        <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                                            <span className="inline-flex items-center gap-1"><Hash size={9} />{r.reference_no}</span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{r.operator_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {data.total > 0 && (
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                            <span className="text-xs text-gray-400">
                                {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
                            </span>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                    Prev
                                </button>
                                <span className="text-xs text-gray-500">Page {page} of {totalPages || 1}</span>
                                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}