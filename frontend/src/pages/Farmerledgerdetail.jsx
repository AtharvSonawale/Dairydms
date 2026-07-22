import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
    ArrowLeft, Wallet, Milk, Banknote, TrendingUp, User, Phone,
    MapPin, CreditCard, Hash, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";

import api from "../api/axios";

const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const fmtDateTime = (d) => d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const iso = (d) => d.toISOString().split("T")[0];

const TYPE_STYLE = {
    milk_sale: "bg-emerald-50 text-emerald-700 border-emerald-100",
    advance_given: "bg-violet-50 text-violet-700 border-violet-100",
    advance_repayment: "bg-violet-50 text-violet-700 border-violet-100",
    advance_recovered: "bg-rose-50 text-rose-700 border-rose-100",
    deposit_taken: "bg-blue-50 text-blue-700 border-blue-100",
    deposit_held: "bg-blue-50 text-blue-700 border-blue-100",
    deposit_refund: "bg-blue-50 text-blue-700 border-blue-100",
    deposit_withdrawn: "bg-rose-50 text-rose-700 border-rose-100",
    deposit_refund: "bg-blue-50 text-blue-700 border-blue-100",
    deposit_withdrawn: "bg-rose-50 text-rose-700 border-rose-100",
    product_purchase: "bg-amber-50 text-amber-700 border-amber-100",
    cattle_feed_purchase: "bg-emerald-50 text-emerald-700 border-emerald-100",
    walkin_purchase: "bg-orange-50 text-orange-700 border-orange-100",
    cash_paid: "bg-gray-900 text-white border-gray-900",
};

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
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
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
            const { data } = await api.get(`/ledger?${params.toString()}`);
            setLedger(data);
        } catch (err) {
            console.error("Failed to load ledger:", err);
        } finally {
            setLedgerLoading(false);
        }
    }, [seller_id, from, to]);

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
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!info) return (
        <div className="min-h-screen bg-[#f5f4f0] flex flex-col items-center justify-center gap-3">
            <p className="text-sm text-gray-400">Farmer not found.</p>
            <Link to="/farmer-ledger" className="text-sm text-violet-600 hover:underline">← Back to Farmer Ledger</Link>
        </div>
    );

    const { seller } = info;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Back link */}
                <Link to="/farmer-ledger" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 transition w-fit">
                    <ArrowLeft size={13} /> Back to Farmer Ledger
                </Link>

                {/* Farmer header card */}
                <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 flex flex-col gap-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-xl font-bold shrink-0">
                                {seller.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-xl font-bold text-gray-900">{seller.name}</h1>
                                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{seller.seller_code}</span>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${seller.is_active ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
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
                        <div className="text-right shrink-0">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Balance Owed</p>
                            <p className={`text-2xl font-bold ${info.current_balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{fmt(info.current_balance)}</p>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Advance Outstanding" value={fmt(info.advance_balance)}
                        icon={<Banknote size={16} />} color="text-violet-600 bg-violet-50 border-violet-100" />
                    <StatCard label="Deposit Balance" value={fmt(info.deposit_balance)}
                        icon={<Wallet size={16} />} color="text-blue-600 bg-blue-50 border-blue-100" />
                    <StatCard label="Total Milk (all time)" value={`${info.total_milk_qty.toFixed(1)} L`}
                        sub={`${info.total_milk_entries} entries`}
                        icon={<Milk size={16} />} color="text-amber-600 bg-amber-50 border-amber-100" />
                    <StatCard label="Total Milk Value" value={fmt(info.total_milk_amount)}
                        sub={info.last_entry_date ? `Last: ${fmtDate(info.last_entry_date)}` : undefined}
                        icon={<TrendingUp size={16} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
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
                    <input type="date" value={from} disabled={preset !== "custom"}
                        onChange={e => setFrom(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                            focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="date" value={to} disabled={preset !== "custom"}
                        onChange={e => setTo(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                            focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                </div>

                {/* Period summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <StatCard label="Opening Balance" value={fmt(ledger.opening_balance)}
                        icon={<Wallet size={16} />} color="text-gray-600 bg-gray-50 border-gray-100" />
                    <StatCard label="Credit (period)" value={fmt(ledger.total_credit)}
                        icon={<TrendingUp size={16} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                    <StatCard label="Debit (period)" value={fmt(ledger.total_debit)}
                        icon={<Banknote size={16} />} color="text-rose-600 bg-rose-50 border-rose-100" />
                    <StatCard label="Closing Balance" value={fmt(ledger.closing_balance)}
                        icon={<CheckCircle2 size={16} />} color="text-violet-600 bg-violet-50 border-violet-100" />
                </div>

                {/* Tabs */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold w-fit">
                    <button onClick={() => setTab("ledger")}
                        className={`px-4 py-2.5 transition ${tab === "ledger" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                        Ledger Transactions
                    </button>
                    <button onClick={() => setTab("milk")}
                        className={`px-4 py-2.5 transition ${tab === "milk" ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                        Milk Entries
                    </button>
                </div>

                {/* Ledger tab */}
                {tab === "ledger" && (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
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
                                        <tr key={`${r.reference_no}-${r.type}-${i}`} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition">
                                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDateTime(r.ts)}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-block text-[10px] font-semibold px-2 py-1 rounded-full border ${TYPE_STYLE[r.type] || "bg-gray-50 text-gray-600 border-gray-100"}`}>
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
                    </div>
                )}

                {/* Milk entries tab */}
                {tab === "milk" && (
                    <div className="flex flex-col gap-3">
                        {milkLoading ? (
                            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-gray-200">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : milkDays.length === 0 ? (
                            <div className="flex items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 text-gray-300 text-sm">
                                No milk entries in this period.
                            </div>
                        ) : milkDays.map(day => {
                            const dayEntries = milkByDay[day];
                            const dayQty = dayEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                            const dayAmt = dayEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
                            const isOpen = expandedDay === day;
                            return (
                                <div key={day} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                                    <button onClick={() => setExpandedDay(isOpen ? null : day)}
                                        className="w-full flex items-center justify-between px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold text-gray-800">{fmtDate(day)}</span>
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
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
                                        <div className="border-t border-gray-100 overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="bg-gray-50">
                                                        {["Shift", "Type", "Qty (L)", "Fat", "SNF", "Rate", "Amount"].map(h => (
                                                            <th key={h} className="px-4 py-2 text-left font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dayEntries.map((e, i) => (
                                                        <tr key={i} className="border-t border-gray-50">
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
                )}
            </main>
        </div>
    );
}