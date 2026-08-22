// BonusReport.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    BarChart3, Download, Search, Calendar,
    DollarSign, Clock, AlertTriangle, X, Users, TrendingUp,
    BadgeCheck, ArrowUpDown, Milk, ChevronDown, ChevronUp,
    Gift, CheckCircle2, RotateCcw, RefreshCw,
    Home, Settings
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
}) : "—";
const fmtShort = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

// ── Sub-components ────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 relative z-10 opacity-70">{icon}</div>
            <div className="relative z-10">
                <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function BonusReport() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── State ───────────────────────────────────────────────────
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [registerData, setRegisterData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // ── Search / filter / sort / pagination ─────────────────────
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ── Expand for slab details ─────────────────────────────────
    const [expanded, setExpanded] = useState({});
    const [updating, setUpdating] = useState({});

    const [flash, setFlash] = useState(null);
    const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 3500); };

    // ── Tour ─────────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                { element: '[data-tour="bonus-event-select"]', popover: { title: "Select Bonus Event", description: "Choose a bonus event to view its register." } },
                { element: '[data-tour="bonus-stats"]', popover: { title: "Bonus Totals", description: "Total quantity, bonus amount, and number of sellers." } },
                { element: '[data-tour="bonus-table"]', popover: { title: "Bonus Register", description: "Each seller's total bonus. Click expand to see slab breakdown." } },
            ],
        });
        driverObj.drive();
    };

    // ── API calls ────────────────────────────────────────────────
    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const { data } = await api.get("/bonus/events");
            setEvents(data);
            if (data.length > 0 && !selectedEventId) {
                setSelectedEventId(data[0].event_id);
            }
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to load events.");
        } finally {
            setLoadingEvents(false);
        }
    };

    const fetchRegister = async (eventId) => {
        if (!eventId) return;
        setLoading(true);
        try {
            const { data } = await api.get(`/bonus/register/${eventId}`);
            setRegisterData(data);
            setExpanded({});
            setCurrentPage(1);
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to load register.");
            setRegisterData(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            fetchRegister(selectedEventId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventId]);

    const handleRefresh = async () => {
        if (selectedEventId) {
            setRefreshing(true);
            await fetchRegister(selectedEventId);
            setRefreshing(false);
        } else {
            await fetchEvents();
        }
    };

    // ── Filter, sort, paginate ──────────────────────────────────
    const filteredSellers = useMemo(() => {
        if (!registerData) return [];
        let sellers = registerData.sellers || [];

        if (search.trim()) {
            sellers = sellers.filter(s =>
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                (s.seller_code || "").toLowerCase().includes(search.toLowerCase())
            );
        }

        if (filterStatus === "paid") {
            sellers = sellers.filter(s => s.is_paid);
        } else if (filterStatus === "unpaid") {
            sellers = sellers.filter(s => !s.is_paid);
        }

        sellers.sort((a, b) => {
            if (sortBy === "name") return a.name.localeCompare(b.name);
            if (sortBy === "qty") return b.total_qty - a.total_qty;
            if (sortBy === "bonus") return b.total_bonus - a.total_bonus;
            return 0;
        });

        return sellers;
    }, [registerData, search, filterStatus, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredSellers.length / pageSize));
    const paginatedSellers = filteredSellers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ── Overall stats ─────────────────────────────────────────────
    const stats = useMemo(() => {
        if (!registerData) return { totalQty: 0, totalBonus: 0, paidCount: 0, totalSellers: 0 };
        const sellers = registerData.sellers || [];
        const totalQty = sellers.reduce((sum, s) => sum + s.total_qty, 0);
        const totalBonus = sellers.reduce((sum, s) => sum + s.total_bonus, 0);
        const paidCount = sellers.filter(s => s.is_paid).length;
        return { totalQty, totalBonus, paidCount, totalSellers: sellers.length };
    }, [registerData]);

    // ── Mark as paid / undo ─────────────────────────────────────
    const handleMarkPaid = async (sellerId) => {
        if (!selectedEventId) {
            showFlash("error", "No event selected.");
            return;
        }
        setUpdating(prev => ({ ...prev, [sellerId]: true }));
        try {
            await api.post(`/bonus/events/${selectedEventId}/mark-paid`, { seller_id: sellerId });
            showFlash("success", "Bonus marked as paid.");
            await fetchRegister(selectedEventId);
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to mark paid.");
        } finally {
            setUpdating(prev => ({ ...prev, [sellerId]: false }));
        }
    };

    const handleUndoPaid = async (sellerId) => {
        if (!selectedEventId) {
            showFlash("error", "No event selected.");
            return;
        }
        if (!window.confirm("Are you sure you want to undo this payment?")) return;
        setUpdating(prev => ({ ...prev, [sellerId]: true }));
        try {
            await api.delete(`/bonus/events/${selectedEventId}/undo-paid/${sellerId}`);
            showFlash("success", "Payment undone.");
            await fetchRegister(selectedEventId);
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to undo.");
        } finally {
            setUpdating(prev => ({ ...prev, [sellerId]: false }));
        }
    };

    // ── Export PDF ───────────────────────────────────────────────
    const handleExportPDF = () => {
        if (!registerData) return;
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) { showFlash("error", "Popup blocked."); return; }

        const event = registerData.event;
        const periodLabel = `${fmtDate(event.from_date)} – ${fmtDate(event.to_date)}`;

        const rows = filteredSellers.map((s, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
                <td class="td-no">${i + 1}</td>
                <td class="td-name">
                    <div class="name-full">${s.name}</div>
                    ${s.seller_code ? `<div class="name-sub">${s.seller_code}</div>` : ""}
                </td>
                <td class="td-num">${s.total_qty.toFixed(2)} L</td>
                <td class="td-num td-bold">${fmt(s.total_bonus)}</td>
                <td class="td-center">
                    ${s.is_paid ? `<span style="color:#15803d;">✓ Paid</span>` :
                `<span style="color:#b91c1c;">Unpaid</span>`}
                </td>
                <td class="td-center">${s.is_paid ? fmtDate(s.paid_at) : "—"}</td>
            </tr>`).join("");

        const grandQty = filteredSellers.reduce((a, s) => a + s.total_qty, 0);
        const grandBonus = filteredSellers.reduce((a, s) => a + s.total_bonus, 0);

        win.document.write(`<!DOCTYPE html>
<html><head><title>Bonus Report — ${event.event_name}</title>
<style>
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:10px; color:#111; margin:0; padding:16px; }
  .report-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; padding-bottom:10px; border-bottom:3px double #1e3a8a; gap:12px; flex-wrap:wrap; }
  .report-title { font-size:17px; font-weight:900; color:#1e3a8a; }
  .report-sub { font-size:9px; color:#475569; margin-top:3px; }
  .report-gen { font-size:8px; color:#94a3b8; text-align:right; }
  table { border-collapse:collapse; width:100%; table-layout:auto; }
  th,td { border:1px solid #e2e8f0; padding:5px 7px; white-space:nowrap; }
  thead th { background:#0f172a; color:#fff; font-size:8.5px; text-transform:uppercase; letter-spacing:0.3px; }
  .td-no { text-align:center; font-size:8px; color:#94a3b8; }
  .td-name { font-weight:700; font-size:9.5px; min-width:130px; }
  .name-sub { font-size:7.5px; color:#94a3b8; font-family:monospace; margin-top:1px; }
  .td-num { text-align:right; font-size:9px; }
  .td-bold { font-weight:800; }
  .td-center { text-align:center; font-size:8px; }
  .grand-row td { background:#1e293b; color:#fff; font-weight:800; font-size:9px; text-align:center; }
  .report-footer { margin-top:16px; display:flex; justify-content:space-between; align-items:flex-end; font-size:8px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; }
  .signatory-line { width:150px; border-top:1.5px solid #374151; margin-bottom:4px; }
  .signatory-label { color:#374151; font-size:9px; font-weight:600; }
  @media print { @page { margin:8mm; size:A4 landscape; } body { padding:0; } }
</style></head>
<body>
<div class="report-header">
  <div>
    <div class="report-title">Bonus Report</div>
    <div class="report-sub">${event.event_name} · ${periodLabel} · ${filteredSellers.length} sellers</div>
  </div>
  <div class="report-gen">Generated: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th style="text-align:left">Seller</th><th>Total Qty</th><th>Bonus Amount</th><th>Status</th><th>Paid At</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="grand-row">
      <td colspan="2">GRAND TOTAL</td>
      <td>${grandQty.toFixed(2)} L</td>
      <td>${fmt(grandBonus)}</td>
      <td colspan="2">${stats.paidCount} / ${stats.totalSellers} paid</td>
    </tr>
  </tbody>
</table>
<div class="report-footer">
  <span>Bonus Report · Printed ${new Date().toLocaleString()}</span>
  <div style="text-align:center">
    <div class="signatory-line"></div>
    <span class="signatory-label">Authorised Signatory</span>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
        win.document.close();
    };

    // ── Render ─────────────────────────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('bonus', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Bonus Report
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            View bonus details for sellers per event
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={startTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> Take a Tour
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm disabled:opacity-50"
                        >
                            <RefreshCw size={15} className={refreshing || loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={!registerData || filteredSellers.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            <Download size={16} /> Export PDF
                        </button>
                    </div>
                </div>

                {/* ── Event Selector ── */}
                <div className="flex items-center gap-3 flex-wrap" data-tour="bonus-event-select">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Select Event</span>
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(parseInt(e.target.value))}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition min-w-[200px]"
                            disabled={loadingEvents}
                        >
                            <option value="">Select an event</option>
                            {events.map(ev => (
                                <option key={ev.event_id} value={ev.event_id}>
                                    {ev.event_name} ({fmtDate(ev.from_date)} – {fmtDate(ev.to_date)})
                                </option>
                            ))}
                        </select>
                    </div>
                    {loadingEvents && <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />}
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success"
                            ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={18} />}
                        {flash.type === "success" && <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Stats ── */}
                {registerData && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-tour="bonus-stats">
                        <StatCard
                            label="Total Milk"
                            value={`${stats.totalQty.toFixed(2)} L`}
                            icon={<Milk size={16} />}
                            color="from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700"
                        />
                        <StatCard
                            label="Total Bonus"
                            value={fmt(stats.totalBonus)}
                            icon={<DollarSign size={16} />}
                            color="from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700"
                        />
                        <StatCard
                            label="Paid Sellers"
                            value={`${stats.paidCount} / ${stats.totalSellers}`}
                            icon={<CheckCircle2 size={16} />}
                            color="from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700"
                        />
                        <StatCard
                            label="Unpaid Sellers"
                            value={stats.totalSellers - stats.paidCount}
                            icon={<Clock size={16} />}
                            color="from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600"
                        />
                    </div>
                )}

                {/* ── Search, Filter, Sort ── */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder="Search by seller name or code"
                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition placeholder:text-gray-300"
                        />
                    </div>

                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            ["all", "All"],
                            ["paid", "Paid"],
                            ["unpaid", "Unpaid"],
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => { setFilterStatus(v); setCurrentPage(1); }}
                                className={`px-3.5 py-2 transition-all duration-200 border-r last:border-r-0 border-gray-200/60
                                    ${filterStatus === v
                                        ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30"
                                        : "text-gray-500 hover:bg-gray-100/50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm text-xs">
                        <ArrowUpDown size={14} className="text-gray-400" />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition">
                            <option value="name">Sort: Name</option>
                            <option value="qty">Sort: Quantity</option>
                            <option value="bonus">Sort: Bonus</option>
                        </select>
                    </div>

                    <span className="ml-auto text-xs text-gray-400">
                        {filteredSellers.length} {filteredSellers.length !== 1 ? "sellers" : "seller"}
                    </span>
                </div>

                {/* ── Table ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden" data-tour="bonus-table">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : !registerData ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                            <Gift size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">Select a bonus event to view the register</p>
                        </div>
                    ) : paginatedSellers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                            <Users size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">No sellers found for this event</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                        <th className="px-4 py-3 w-10 border-r border-gray-200/60">#</th>
                                        <th className="px-4 py-3 min-w-[130px] border-r border-gray-200/60">Seller</th>
                                        <th className="px-4 py-3 text-right border-r border-gray-200/60">Total Qty (L)</th>
                                        <th className="px-4 py-3 text-right border-r border-gray-200/60">Bonus Amount</th>
                                        <th className="px-4 py-3 text-center border-r border-gray-200/60">Status</th>
                                        <th className="px-4 py-3 text-center border-r border-gray-200/60">Paid At</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSellers.map((seller, idx) => {
                                        const isOpen = expanded[seller.seller_id] || false;
                                        const isPaid = seller.is_paid;
                                        const slabs = registerData?.slabs || [];

                                        return (
                                            <React.Fragment key={seller.seller_id}>
                                                <tr className={`border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors ${isPaid ? 'bg-emerald-50/20' : ''}`}>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400 border-r border-gray-100/60">
                                                        {idx + 1 + (currentPage - 1) * pageSize}
                                                    </td>
                                                    <td className="px-4 py-3 border-r border-gray-100/60">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm
                                                                ${isPaid
                                                                    ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30"
                                                                    : "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30"}`}>
                                                                {seller.name?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800 truncate">{seller.name}</p>
                                                                {seller.seller_code && <p className="text-[10px] text-gray-400">{seller.seller_code}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-blue-600 border-r border-gray-100/60">
                                                        {seller.total_qty.toFixed(2)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-amber-600 border-r border-gray-100/60">
                                                        {fmt(seller.total_bonus)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center border-r border-gray-100/60">
                                                        {isPaid ? (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm border-emerald-200/60 bg-emerald-50/80 text-emerald-700">
                                                                <CheckCircle2 size={11} /> Paid
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm border-rose-200/60 bg-rose-50/80 text-rose-700">
                                                                <Clock size={11} /> Unpaid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400 border-r border-gray-100/60">
                                                        {isPaid ? fmtShort(seller.paid_at) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {!isPaid && can('bonus', 'W') && (
                                                                <button
                                                                    onClick={() => handleMarkPaid(seller.seller_id)}
                                                                    disabled={updating[seller.seller_id]}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 text-white text-[10px] font-semibold transition-all duration-200 shadow-sm disabled:opacity-50"
                                                                >
                                                                    {updating[seller.seller_id] ? (
                                                                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <CheckCircle2 size={10} />
                                                                    )}
                                                                    Mark Paid
                                                                </button>
                                                            )}
                                                            {isPaid && can('bonus', 'W') && (
                                                                <button
                                                                    onClick={() => handleUndoPaid(seller.seller_id)}
                                                                    disabled={updating[seller.seller_id]}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 text-[10px] font-semibold border border-rose-200/60 backdrop-blur-sm transition shadow-sm disabled:opacity-50"
                                                                >
                                                                    <RotateCcw size={10} /> Undo
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => setExpanded(prev => ({ ...prev, [seller.seller_id]: !prev[seller.seller_id] }))}
                                                                className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm shadow-sm"
                                                            >
                                                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* ── Expanded slab details ── */}
                                                {isOpen && (
                                                    <tr>
                                                        <td colSpan="7" className="px-4 py-4 bg-gray-50/50 backdrop-blur-sm border-t border-gray-200/60">
                                                            <div className="flex flex-col gap-2">
                                                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                                    Slab-wise breakdown
                                                                </p>
                                                                {slabs.length === 0 ? (
                                                                    <p className="text-xs text-gray-400">No slabs configured.</p>
                                                                ) : (
                                                                    <div className="rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm overflow-hidden shadow-sm">
                                                                        <div className="grid bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60"
                                                                            style={{ gridTemplateColumns: "120px 120px 100px 1fr 120px" }}>
                                                                            {["Fat Range", "Rate / L", "Vahatuk", "Qty (L)", "Amount"].map(h => (
                                                                                <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">{h}</div>
                                                                            ))}
                                                                        </div>
                                                                        {slabs.map((slab, idx) => {
                                                                            const bucket = seller.buckets?.find(b => b.slab_id === slab.slab_id);
                                                                            const qty = bucket?.qty || 0;
                                                                            const amt = bucket?.amt || 0;
                                                                            if (qty === 0 && amt === 0) return null;
                                                                            return (
                                                                                <div key={idx} className="grid border-b border-gray-100/60 last:border-0 hover:bg-white/50 transition"
                                                                                    style={{ gridTemplateColumns: "120px 120px 100px 1fr 120px" }}>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100/60">
                                                                                        {slab.fat_min} – {slab.fat_max}%
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100/60">
                                                                                        {fmt(slab.rate)}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100/60">
                                                                                        {slab.vahatuk}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600 font-mono text-right border-r border-gray-100/60">
                                                                                        {qty.toFixed(2)}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs font-semibold text-amber-600 text-right">
                                                                                        {fmt(amt)}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        <div className="grid bg-gradient-to-r from-gray-50/50 to-white/50 border-t border-gray-200/60 font-semibold"
                                                                            style={{ gridTemplateColumns: "120px 120px 100px 1fr 120px" }}>
                                                                            <div className="px-3 py-2 text-xs text-gray-600 border-r border-gray-200/60">Total</div>
                                                                            <div className="border-r border-gray-200/60"></div>
                                                                            <div className="border-r border-gray-200/60"></div>
                                                                            <div className="px-3 py-2 text-xs text-gray-800 text-right border-r border-gray-200/60">
                                                                                {seller.total_qty.toFixed(2)}
                                                                            </div>
                                                                            <div className="px-3 py-2 text-xs text-amber-700 text-right">
                                                                                {fmt(seller.total_bonus)}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ── Pagination ── */}
                    {filteredSellers.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-t border-gray-200/60 bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                                    Prev
                                </button>
                                <span className="text-xs text-gray-600">Page {currentPage} of {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                                    Next
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Rows per page:</span>
                                <select value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition">
                                    {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('bonusReport.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('bonusReport.footerEvent', { defaultValue: 'Event' })}: <strong className="text-gray-600">{registerData?.event?.event_name || '—'}</strong></span>
                    <span>· {t('bonusReport.footerTotalSellers', { defaultValue: 'Total sellers' })}: <strong className="text-gray-600">{stats.totalSellers}</strong></span>
                </div>

            </main>
        </div>
    );
}