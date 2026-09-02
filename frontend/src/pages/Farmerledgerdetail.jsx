import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft, Wallet, Milk, Banknote, TrendingUp, User, Phone,
    MapPin, CreditCard, Hash, CheckCircle2, ChevronDown, ChevronUp,
    Home
} from "lucide-react";

import api from "../api/axios";

// ── SectionCard Component (matching Settings page) ────────────────────────────
function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" {...rest}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 relative z-10">{children}</div>
        </div>
    );
}

const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const iso = (d) => d.toISOString().split("T")[0];

const TYPE_STYLE = {
    milk_sale: "bg-emerald-50/80 text-emerald-700 border-emerald-200/60",
    advance_given: "bg-violet-50/80 text-violet-700 border-violet-200/60",
    advance_repayment: "bg-violet-50/80 text-violet-700 border-violet-200/60",
    advance_recovered: "bg-rose-50/80 text-rose-700 border-rose-200/60",
    deposit_taken: "bg-blue-50/80 text-blue-700 border-blue-200/60",
    deposit_held: "bg-blue-50/80 text-blue-700 border-blue-200/60",
    deposit_refund: "bg-blue-50/80 text-blue-700 border-blue-200/60",
    deposit_withdrawn: "bg-rose-50/80 text-rose-700 border-rose-200/60",
    product_purchase: "bg-amber-50/80 text-amber-700 border-amber-200/60",
    cattle_feed_purchase: "bg-emerald-50/80 text-emerald-700 border-emerald-200/60",
    walkin_purchase: "bg-orange-50/80 text-orange-700 border-orange-200/60",
    cash_paid: "bg-gradient-to-br from-gray-800 to-gray-900 text-white border-gray-700",
};

// Options for the "Type" filter dropdown — mirrors backend TYPE_LABELS
const TYPE_FILTER_OPTIONS = [
    { value: "", label: "All Types" },
    { value: "milk_sale", label: "Milk Sale" },
    { value: "advance_given", label: "Advance Given" },
    { value: "advance_repayment", label: "Advance Repayment" },
    { value: "advance_recovered", label: "Advance Installment Recovered" },
    { value: "deposit_taken", label: "Deposit Taken" },
    { value: "deposit_held", label: "Deposit Held" },
    { value: "deposit_refund", label: "Deposit Refunded" },
    { value: "deposit_withdrawn", label: "Deposit Withdrawn" },
    { value: "product_purchase", label: "Product Purchase" },
    { value: "cattle_feed_purchase", label: "Cattle Feed Purchase" },
    { value: "walkin_purchase", label: "Milk Purchase (Walk-in)" },
    { value: "cash_paid", label: "Payment Settled" },
];

// Builds a {from, to} range for a given preset, anchored on "today".
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

function StatCard({ label, value, sub, icon, color }) {
    return (
        <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border ${color} bg-white/60 backdrop-blur-sm shadow-sm min-w-0`}>
            <div className="shrink-0 [&>svg]:w-[14px] [&>svg]:h-[14px] sm:[&>svg]:w-4 sm:[&>svg]:h-4">{icon}</div>
            <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-xs text-gray-400 leading-none truncate">{label}</p>
                <p className="text-sm sm:text-lg font-bold text-gray-900 leading-tight mt-0.5 truncate">{value}</p>
                {sub && <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5 truncate">{sub}</p>}
            </div>
        </div>
    );
}

export default function FarmerLedgerDetail() {
    const { seller_id } = useParams();

    const [info, setInfo] = useState(null);
    const [infoLoading, setInfoLoading] = useState(true);

    const [preset, setPreset] = useState("month");
    const [from, setFrom] = useState(() => rangeFor("month").from);
    const [to, setTo] = useState(() => rangeFor("month").to);

    const [tab, setTab] = useState("ledger"); // 'ledger' | 'milk'
    const [typeFilter, setTypeFilter] = useState("");
    const [ledger, setLedger] = useState({ rows: [], opening_balance: 0, closing_balance: 0, total_credit: 0, total_debit: 0 });
    const [ledgerLoading, setLedgerLoading] = useState(false);

    const [milkEntries, setMilkEntries] = useState([]);
    const [milkLoading, setMilkLoading] = useState(false);
    const [expandedDay, setExpandedDay] = useState(null);

    const fetchInfo = useCallback(async () => {
        setInfoLoading(true);
        try {
            const { data } = await api.get(`/ledger/farmer/${seller_id}`);
            setInfo(data);
        } catch (err) {
            console.error("Failed to load farmer info:", err);
        } finally {
            setInfoLoading(false);
        }
    }, [seller_id]);

    const fetchLedger = useCallback(async () => {
        setLedgerLoading(true);
        try {
            const params = new URLSearchParams({ seller_id, from, to, limit: 500, page: 1 });
            if (typeFilter) params.append("type", typeFilter);
            const { data } = await api.get(`/ledger?${params.toString()}`);
            setLedger(data);
        } catch (err) {
            console.error("Failed to load ledger:", err);
        } finally {
            setLedgerLoading(false);
        }
    }, [seller_id, from, to, typeFilter]);

    const fetchMilk = useCallback(async () => {
        setMilkLoading(true);
        try {
            const params = new URLSearchParams({ from, to });
            const { data } = await api.get(`/ledger/farmer/${seller_id}/milk-entries?${params.toString()}`);
            setMilkEntries(data);
        } catch (err) {
            console.error("Failed to load milk entries:", err);
        } finally {
            setMilkLoading(false);
        }
    }, [seller_id, from, to]);

    useEffect(() => { fetchInfo(); }, [fetchInfo]);
    useEffect(() => { fetchLedger(); }, [fetchLedger]);
    useEffect(() => { if (tab === "milk") fetchMilk(); }, [tab, fetchMilk]);

    const selectPreset = (p) => {
        setPreset(p);
        if (p !== "custom") {
            const r = rangeFor(p);
            setFrom(r.from);
            setTo(r.to);
        }
    };

    // Group milk entries by date for the daily breakdown view
    const milkByDay = milkEntries.reduce((acc, e) => {
        const d = e.entry_date?.split("T")[0];
        if (!acc[d]) acc[d] = [];
        acc[d].push(e);
        return acc;
    }, {});
    const milkDays = Object.keys(milkByDay).sort((a, b) => new Date(b) - new Date(a));

    if (infoLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!info) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-gray-400">Farmer not found.</p>
            <Link to="/farmer-ledger" className="text-sm text-violet-600 hover:underline">← Back to Farmer Ledger</Link>
        </div>
    );

    const { seller } = info;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-[1800px] mx-auto px-2 sm:px-6 py-4 sm:py-6 flex flex-col gap-6">                {/* ── Back link ── */}
                <Link to="/farmer-ledger" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition w-fit">
                    <ArrowLeft size={13} /> Back to Farmer Ledger
                </Link>

                {/* ── Farmer header card ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-600 text-white flex items-center justify-center text-xl font-bold shrink-0 shadow-lg shadow-violet-500/20">
                                {seller.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-bold text-gray-900">{seller.name}</h1>
                                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100/80 text-gray-500 border border-gray-200/60">
                                        {seller.seller_code}
                                    </span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${seller.is_active ? "bg-emerald-50/80 text-emerald-600 border-emerald-200/60" : "bg-rose-50/80 text-rose-600 border-rose-200/60"}`}>
                                        {seller.is_active ? "Active" : "Inactive"}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400 flex-wrap">
                                    <span className="flex items-center gap-1"><Phone size={11} /> {seller.mobile}</span>
                                    <span className="flex items-center gap-1"><User size={11} /> {seller.seller_type} · {seller.milk_type}</span>
                                    {seller.address && <span className="flex items-center gap-1"><MapPin size={11} /> {seller.address}</span>}
                                    {seller.bank_account && <span className="flex items-center gap-1"><CreditCard size={11} /> {seller.bank_name} · {seller.bank_account}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="text-left sm:text-right shrink-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Balance Owed</p>
                            <p className={`text-2xl font-bold ${info.current_balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(info.current_balance)}</p>
                        </div>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">                    <StatCard label="Advance Outstanding" value={fmt(info.advance_balance)}
                        icon={<Banknote size={16} className="text-violet-600" />}
                        color="text-violet-600 bg-violet-50/80 border-violet-200/60" />
                    <StatCard label="Deposit Balance" value={fmt(info.deposit_balance)}
                        icon={<Wallet size={16} className="text-blue-600" />}
                        color="text-blue-600 bg-blue-50/80 border-blue-200/60" />
                    <StatCard label="Total Milk (all time)" value={`${info.total_milk_qty.toFixed(1)} L`}
                        sub={`${info.total_milk_entries} entries`}
                        icon={<Milk size={16} className="text-amber-600" />}
                        color="text-amber-600 bg-amber-50/80 border-amber-200/60" />
                    <StatCard label="Total Milk Value" value={fmt(info.total_milk_amount)}
                        sub={info.last_entry_date ? `Last: ${fmtDate(info.last_entry_date)}` : undefined}
                        icon={<TrendingUp size={16} className="text-emerald-600" />}
                        color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60" />
                </div>

                {/* ── Date filter ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5 w-full sm:w-auto overflow-x-auto">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Period</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold w-max">
                                {[["day", "Day"], ["week", "Week"], ["month", "Month"], ["year", "Year"], ["custom", "Custom"]].map(([v, l]) => (
                                    <button key={v} onClick={() => selectPreset(v)}
                                        className={`px-3 sm:px-4 py-2 whitespace-nowrap transition-all duration-200 ${preset === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex flex-col gap-0.5 w-full sm:w-auto">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">From</span>
                            <input type="date" value={from} disabled={preset !== "custom"}
                                onChange={e => setFrom(e.target.value)}
                                className="w-full sm:w-auto border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm disabled:bg-gray-100/60 disabled:text-gray-400 disabled:cursor-not-allowed" />
                        </div>
                        <div className="flex flex-col gap-0.5 w-full sm:w-auto">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">To</span>
                            <input type="date" value={to} disabled={preset !== "custom"}
                                onChange={e => setTo(e.target.value)}
                                className="w-full sm:w-auto border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm disabled:bg-gray-100/60 disabled:text-gray-400 disabled:cursor-not-allowed" />
                        </div>
                        {preset !== "custom" && (
                            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-50/60 border border-gray-200/60 text-gray-500 text-xs font-medium shadow-sm">
                                <span>{new Date(from).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                                <span className="text-gray-300">→</span>
                                <span>{new Date(to).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Period summary ── */}
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-3">
                    <StatCard label="Opening Balance" value={fmt(ledger.opening_balance)}
                        icon={<Wallet size={16} className="text-gray-600" />}
                        color="text-gray-600 bg-gray-50/80 border-gray-200/60" />
                    <StatCard label="Credit (period)" value={fmt(ledger.total_credit)}
                        icon={<TrendingUp size={16} className="text-emerald-600" />}
                        color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60" />
                    <StatCard label="Debit (period)" value={fmt(ledger.total_debit)}
                        icon={<Banknote size={16} className="text-rose-600" />}
                        color="text-rose-600 bg-rose-50/80 border-rose-200/60" />
                    <StatCard label="Closing Balance" value={fmt(ledger.closing_balance)}
                        icon={<CheckCircle2 size={16} className="text-violet-600" />}
                        color="text-violet-600 bg-violet-50/80 border-violet-200/60" />
                </div>

                {/* ── Tabs + Type filter ── */}
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/60 backdrop-blur-sm shadow-sm w-fit">
                        <button onClick={() => setTab("ledger")}
                            className={`px-4 py-2.5 transition-all duration-200 ${tab === "ledger" ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                            Ledger Transactions
                        </button>
                        <button onClick={() => setTab("milk")}
                            className={`px-4 py-2.5 transition-all duration-200 ${tab === "milk" ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                            Milk Entries
                        </button>
                    </div>

                    {tab === "ledger" && (
                        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
                            className="w-full sm:w-auto max-w-full border border-gray-200/60 rounded-xl px-3 py-2.5 text-xs font-semibold text-gray-600 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm">
                            {TYPE_FILTER_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* ── Ledger tab ── */}
                {tab === "ledger" && (
                    <SectionCard
                        title="Transaction History"
                        icon={<Banknote size={16} className="text-white" />}
                    >
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200/60">
                                        {["Date & Time", "Type", "Description", "Debit", "Credit", "Running Balance", "Payment Mode", "Reference", "Operator"].map(h => (
                                            <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledgerLoading ? (
                                        <tr><td colSpan={9} className="py-16 text-center">
                                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin mx-auto" />
                                        </td></tr>
                                    ) : ledger.rows.length === 0 ? (
                                        <tr><td colSpan={9} className="py-16 text-center text-gray-300 text-sm">No transactions in this period.</td></tr>
                                    ) : ledger.rows.map((r, i) => (
                                        <tr key={`${r.reference_no}-${r.type}-${i}`} className="border-b border-gray-200/60 last:border-0 hover:bg-gray-50/50 transition">
                                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(r.ts)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-block text-[10px] font-semibold px-2 py-1 rounded-full border ${TYPE_STYLE[r.type] || "bg-gray-50/80 text-gray-600 border-gray-200/60"}`}>
                                                    {r.type_label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-gray-600 max-w-sm truncate" title={r.description}>{r.description}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-rose-600 whitespace-nowrap">{r.debit > 0 ? fmt(r.debit) : "—"}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs text-emerald-600 whitespace-nowrap">{r.credit > 0 ? fmt(r.credit) : "—"}</td>
                                            <td className="px-4 py-3 text-right font-mono text-xs font-bold text-gray-900 whitespace-nowrap">{fmt(r.running_balance)}</td>
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
                    </SectionCard>
                )}

                {/* ── Milk entries tab ── */}
                {tab === "milk" && (
                    <SectionCard
                        title="Milk Entries"
                        icon={<Milk size={16} className="text-white" />}
                    >
                        <div className="flex flex-col gap-3">
                            {milkLoading ? (
                                <div className="flex items-center justify-center py-16 bg-white/30 backdrop-blur-sm rounded-xl border border-gray-200/60">
                                    <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                                </div>
                            ) : milkDays.length === 0 ? (
                                <div className="flex items-center justify-center py-16 bg-white/30 backdrop-blur-sm rounded-xl border border-gray-200/60 text-gray-300 text-sm">
                                    No milk entries in this period.
                                </div>
                            ) : milkDays.map(day => {
                                const dayEntries = milkByDay[day];
                                const dayQty = dayEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                                const dayAmt = dayEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
                                const isOpen = expandedDay === day;
                                return (
                                    <div key={day} className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-200/60 overflow-hidden shadow-sm">
                                        <button onClick={() => setExpandedDay(isOpen ? null : day)}
                                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm font-semibold text-gray-800">{fmtDate(day)}</span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50/80 text-amber-600 border border-amber-200/60">
                                                    {dayEntries.length} {dayEntries.length === 1 ? "entry" : "entries"}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-xs text-gray-500 font-mono">{dayQty.toFixed(2)} L</span>
                                                <span className="text-sm font-bold text-gray-900">{fmt(dayAmt)}</span>
                                                {isOpen ? <ChevronUp size={15} className="text-gray-300" /> : <ChevronDown size={15} className="text-gray-300" />}
                                            </div>
                                        </button>
                                        {isOpen && (
                                            <div className="border-t border-gray-200/60 overflow-x-auto">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="bg-gray-50/80">
                                                            {["Shift", "Type", "Qty (L)", "Fat", "SNF", "Rate", "Amount"].map(h => (
                                                                <th key={h} className="px-4 py-2 text-left font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {dayEntries.map((e, i) => (
                                                            <tr key={i} className="border-t border-gray-200/60 hover:bg-gray-50/30 transition">
                                                                <td className="px-4 py-2 capitalize">{e.shift === "morning" ? "☀ Morning" : "🌙 Evening"}</td>
                                                                <td className="px-4 py-2 capitalize">{e.milk_type}</td>
                                                                <td className="px-4 py-2 font-mono text-blue-600">{parseFloat(e.quantity).toFixed(2)}</td>
                                                                <td className="px-4 py-2 font-mono text-amber-600">{parseFloat(e.fat).toFixed(1)}</td>
                                                                <td className="px-4 py-2 font-mono text-violet-600">{parseFloat(e.snf).toFixed(1)}</td>
                                                                <td className="px-4 py-2 font-mono">{fmt(e.rate_applied)}</td>
                                                                <td className="px-4 py-2 font-mono font-semibold">{fmt(e.total_amount)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </SectionCard>
                )}

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• <span className="text-emerald-600 font-semibold">Credit</span> — money added to farmer's account</span>
                    <span>• <span className="text-rose-600 font-semibold">Debit</span> — money deducted from farmer's account</span>
                    <span>• <span className="text-violet-600 font-semibold">Balance</span> — running net position</span>
                </div>

            </main>
        </div>
    );
}