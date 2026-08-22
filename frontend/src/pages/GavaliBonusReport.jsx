// GavaliBonusReport.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    Download, Search, Calendar,
    DollarSign, Clock, AlertTriangle, X, Users, TrendingUp,
    BadgeCheck, ArrowUpDown, Milk, ChevronDown, ChevronUp,
    Gift, CheckCircle2, RotateCcw, RefreshCw, Home
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
const fmtQty = (n) => parseFloat(n || 0).toFixed(2);

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

// ── Sub-components ────────────────────────────────────────────
function StatCard({ label, value, icon, color, sub }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color} bg-white/60 backdrop-blur-sm shadow-sm`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function GavaliBonusReport() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── State ───────────────────────────────────────────────────
    const [events, setEvents] = useState([]);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [registerData, setRegisterData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [dateRange, setDateRange] = useState({ from: today(), to: today() });
    const [rangeMode, setRangeMode] = useState("daily");

    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [expanded, setExpanded] = useState({});
    const [monthlyBreakdown, setMonthlyBreakdown] = useState({});
    const [loadingMonthly, setLoadingMonthly] = useState({});
    const [updating, setUpdating] = useState({});

    const [flash, setFlash] = useState(null);
    const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 3500); };

    // ── Tour ─────────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                { element: '[data-tour="gavali-event-select"]', popover: { title: "Select Gavali Bonus Event", description: "Choose an event or use custom date range." } },
                { element: '[data-tour="gavali-stats"]', popover: { title: "Totals", description: "Total sellers, cow/buffalo quantities, and bonus amount." } },
                { element: '[data-tour="gavali-table"]', popover: { title: "Gavali Sellers", description: "Each seller's bonus breakdown. Expand to see monthly details." } },
            ],
        });
        driverObj.drive();
    };

    // ── API calls ────────────────────────────────────────────────
    const fetchEvents = async () => {
        setLoadingEvents(true);
        try {
            const { data } = await api.get("/gavali-bonus/events");
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
        if (!eventId) {
            await fetchNoEventRegister();
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.get(`/gavali-bonus/events/${eventId}/register`);
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

    const fetchNoEventRegister = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/gavali-bonus/no-event-register?from=${dateRange.from}&to=${dateRange.to}`);
            setRegisterData({
                event: {
                    event_name: "Custom Range",
                    from_date: dateRange.from,
                    to_date: dateRange.to,
                    cow_bonus: 0,
                    buffalo_bonus: 0,
                },
                sellers: data.sellers.map(s => ({
                    ...s,
                    is_paid: false,
                    paid_at: null,
                    total_bonus: 0,
                })),
            });
            setExpanded({});
            setCurrentPage(1);
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to load sellers.");
            setRegisterData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchMonthlyBreakdown = async (sellerId) => {
        let from, to;
        if (selectedEventId && registerData?.event) {
            from = registerData.event.from_date;
            to = registerData.event.to_date;
        } else {
            from = dateRange.from;
            to = dateRange.to;
        }
        setLoadingMonthly(prev => ({ ...prev, [sellerId]: true }));
        try {
            const { data } = await api.get(`/gavali-bonus/monthly-breakdown?from=${from}&to=${to}`);
            setMonthlyBreakdown(prev => ({
                ...prev,
                [sellerId]: data.breakdown[sellerId] || {},
            }));
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to load monthly breakdown.");
        } finally {
            setLoadingMonthly(prev => ({ ...prev, [sellerId]: false }));
        }
    };

    useEffect(() => {
        fetchEvents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (selectedEventId === "") {
            fetchNoEventRegister();
        } else {
            fetchRegister(selectedEventId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEventId, dateRange]);

    const handleRefresh = async () => {
        setRefreshing(true);
        if (selectedEventId) {
            await fetchRegister(selectedEventId);
        } else {
            await fetchNoEventRegister();
        }
        setRefreshing(false);
    };

    const handleDateRangeChange = (mode) => {
        setRangeMode(mode);
        let from = dateRange.from, to = dateRange.to;
        const todayStr = today();

        if (mode === "daily") {
            from = to = todayStr;
        } else if (mode === "weekly") {
            const date = new Date(todayStr);
            const day = date.getDay();
            const monday = new Date(date);
            monday.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
            const sunday = new Date(monday);
            sunday.setDate(monday.getDate() + 6);
            from = monday.toISOString().split("T")[0];
            to = sunday.toISOString().split("T")[0];
        } else if (mode === "monthly") {
            const date = new Date(todayStr);
            const year = date.getFullYear();
            const month = date.getMonth();
            from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
            const lastDay = new Date(year, month + 1, 0).getDate();
            to = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        }
        setDateRange({ from, to });
    };

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
            if (sortBy === "cow") return b.cow_qty - a.cow_qty;
            if (sortBy === "buffalo") return b.buffalo_qty - a.buffalo_qty;
            if (sortBy === "total") return b.total_qty - a.total_qty;
            if (sortBy === "bonus") return b.total_bonus - a.total_bonus;
            return 0;
        });

        return sellers;
    }, [registerData, search, filterStatus, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredSellers.length / pageSize));
    const paginatedSellers = filteredSellers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const stats = useMemo(() => {
        if (!registerData) return { totalSellers: 0, totalCow: 0, totalBuffalo: 0, totalQty: 0, totalBonus: 0, paidCount: 0 };
        const sellers = registerData.sellers || [];
        const totalCow = sellers.reduce((sum, s) => sum + (s.cow_qty || 0), 0);
        const totalBuffalo = sellers.reduce((sum, s) => sum + (s.buffalo_qty || 0), 0);
        const totalQty = sellers.reduce((sum, s) => sum + (s.total_qty || 0), 0);
        const totalBonus = sellers.reduce((sum, s) => sum + (s.total_bonus || 0), 0);
        const paidCount = sellers.filter(s => s.is_paid).length;
        return { totalSellers: sellers.length, totalCow, totalBuffalo, totalQty, totalBonus, paidCount };
    }, [registerData]);

    const handleMarkPaid = async (sellerId) => {
        if (!selectedEventId) {
            showFlash("error", "Please select an event to mark paid.");
            return;
        }
        setUpdating(prev => ({ ...prev, [sellerId]: true }));
        try {
            await api.post(`/gavali-bonus/events/${selectedEventId}/mark-paid`, { seller_id: sellerId });
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
            showFlash("error", "Please select an event to undo payment.");
            return;
        }
        if (!window.confirm("Are you sure you want to undo this payment?")) return;
        setUpdating(prev => ({ ...prev, [sellerId]: true }));
        try {
            await api.post(`/gavali-bonus/events/${selectedEventId}/undo-paid`, { seller_id: sellerId });
            showFlash("success", "Payment undone.");
            await fetchRegister(selectedEventId);
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to undo.");
        } finally {
            setUpdating(prev => ({ ...prev, [sellerId]: false }));
        }
    };

    const toggleExpand = async (sellerId) => {
        const willOpen = !expanded[sellerId];
        setExpanded(prev => ({ ...prev, [sellerId]: willOpen }));
        if (willOpen && !monthlyBreakdown[sellerId]) {
            await fetchMonthlyBreakdown(sellerId);
        }
    };

    const handleExportPDF = () => {
        if (!registerData) return;
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) { showFlash("error", "Popup blocked."); return; }

        const event = registerData.event;
        const periodLabel = event.event_name === "Custom Range"
            ? `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`
            : `${fmtDate(event.from_date)} – ${fmtDate(event.to_date)}`;

        const rows = filteredSellers.map((s, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
                <td class="td-no">${i + 1}</td>
                <td class="td-name">
                    <div class="name-full">${s.name}</div>
                    ${s.seller_code ? `<div class="name-sub">${s.seller_code}</div>` : ""}
                </td>
                <td class="td-num">${fmtQty(s.cow_qty || 0)} L</td>
                <td class="td-num">${fmtQty(s.buffalo_qty || 0)} L</td>
                <td class="td-num">${fmtQty(s.total_qty)} L</td>
                <td class="td-num td-bold">${fmt(s.total_bonus || 0)}</td>
                <td class="td-center">
                    ${s.is_paid ? `<span style="color:#15803d;">✓ Paid</span>` :
                `<span style="color:#b91c1c;">Unpaid</span>`}
                </td>
                <td class="td-center">${s.is_paid ? fmtDate(s.paid_at) : "—"}</td>
            </tr>`).join("");

        const grandCow = filteredSellers.reduce((a, s) => a + (s.cow_qty || 0), 0);
        const grandBuffalo = filteredSellers.reduce((a, s) => a + (s.buffalo_qty || 0), 0);
        const grandQty = filteredSellers.reduce((a, s) => a + (s.total_qty || 0), 0);
        const grandBonus = filteredSellers.reduce((a, s) => a + (s.total_bonus || 0), 0);

        win.document.write(`<!DOCTYPE html>
<html><head><title>Gavali Bonus Report — ${event.event_name}</title>
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
    <div class="report-title">Gavali Bonus Report</div>
    <div class="report-sub">${event.event_name} · ${periodLabel} · ${filteredSellers.length} sellers</div>
  </div>
  <div class="report-gen">Generated: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th style="text-align:left">Seller</th>
      <th>Cow Qty (L)</th><th>Buffalo Qty (L)</th><th>Total Qty (L)</th>
      <th>Bonus Amount</th><th>Status</th><th>Paid At</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="grand-row">
      <td colspan="2">GRAND TOTAL</td>
      <td>${fmtQty(grandCow)} L</td>
      <td>${fmtQty(grandBuffalo)} L</td>
      <td>${fmtQty(grandQty)} L</td>
      <td>${fmt(grandBonus)}</td>
      <td colspan="2">${stats.paidCount} / ${stats.totalSellers} paid</td>
    </tr>
  </tbody>
</table>
<div class="report-footer">
  <span>Gavali Bonus Report · Printed ${new Date().toLocaleString()}</span>
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
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('gavali_bonus', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Gavali Bonus Report
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Bonus details for Gavali sellers
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> Take a Tour
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing || loading}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm disabled:opacity-40"
                        >
                            <RefreshCw size={15} className={refreshing || loading ? "animate-spin" : ""} />
                            Refresh
                        </button>
                        <button
                            onClick={handleExportPDF}
                            disabled={!registerData || filteredSellers.length === 0}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            <Download size={15} /> Export PDF
                        </button>
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === 'success'
                            ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700'
                            : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Event Selector / Date Range ── */}
                <SectionCard 
                    title="Select Period" 
                    icon={<Calendar size={16} className="text-white" />}
                    data-tour="gavali-event-select"
                >
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Event</span>
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-4 py-3 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm min-w-[220px]"
                                disabled={loadingEvents}
                            >
                                <option value="">No Event (Custom Range)</option>
                                {events.map(ev => (
                                    <option key={ev.event_id} value={ev.event_id}>
                                        {ev.event_name} ({fmtDate(ev.from_date)} – {fmtDate(ev.to_date)})
                                    </option>
                                ))}
                            </select>
                            {loadingEvents && <div className="w-4 h-4 border-2 border-gray-200 border-t-black rounded-full animate-spin mt-1" />}
                        </div>

                        {!selectedEventId && (
                            <>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">From</span>
                                    <input
                                        type="date"
                                        value={dateRange.from}
                                        onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="border border-gray-200/60 rounded-xl px-4 py-3 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">To</span>
                                    <input
                                        type="date"
                                        value={dateRange.to}
                                        onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="border border-gray-200/60 rounded-xl px-4 py-3 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Quick Range</span>
                                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold">
                                        {[
                                            { v: "daily", l: "Day" },
                                            { v: "weekly", l: "Week" },
                                            { v: "monthly", l: "Month" },
                                        ].map(({ v, l }) => (
                                            <button key={v} type="button" onClick={() => handleDateRangeChange(v)}
                                                className={`px-4 py-2 transition ${rangeMode === v 
                                                    ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" 
                                                    : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </SectionCard>

                {/* ── Stats ── */}
                {registerData && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="gavali-stats">
                        <StatCard label="Total Sellers" value={stats.totalSellers}
                            icon={<Users size={14} />}
                            color="text-blue-600 bg-blue-50/80 border-blue-200/60" />
                        <StatCard label="Cow Milk" value={`${fmtQty(stats.totalCow)} L`}
                            icon={<Milk size={14} className="text-amber-600" />}
                            color="text-amber-600 bg-amber-50/80 border-amber-200/60" />
                        <StatCard label="Buffalo Milk" value={`${fmtQty(stats.totalBuffalo)} L`}
                            icon={<Milk size={14} className="text-blue-600" />}
                            color="text-blue-600 bg-blue-50/80 border-blue-200/60" />
                        <StatCard label="Total Bonus" value={fmt(stats.totalBonus)}
                            sub={`${stats.paidCount} / ${stats.totalSellers} paid`}
                            icon={<DollarSign size={14} />}
                            color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60" />
                    </div>
                )}

                {/* ── Search, Filter, Sort ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input 
                                value={search} 
                                onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                                placeholder="Search by seller name or code"
                                className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm placeholder:text-gray-300" 
                            />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold">
                                {[
                                    ["all", "All"],
                                    ["paid", "Paid"],
                                    ["unpaid", "Unpaid"],
                                ].map(([v, l]) => (
                                    <button key={v} onClick={() => { setFilterStatus(v); setCurrentPage(1); }}
                                        className={`px-4 py-2 transition border-r last:border-r-0 border-gray-200/60
                                            ${filterStatus === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Sort By</span>
                            <div className="flex items-center gap-1.5">
                                <ArrowUpDown size={12} className="text-gray-400" />
                                <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                                    className="border border-gray-200/60 rounded-xl px-3 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm">
                                    <option value="name">Name</option>
                                    <option value="cow">Cow Qty</option>
                                    <option value="buffalo">Buffalo Qty</option>
                                    <option value="total">Total Qty</option>
                                    <option value="bonus">Bonus</option>
                                </select>
                            </div>
                        </div>

                        <div className="ml-auto text-xs text-gray-400">
                            {filteredSellers.length} {filteredSellers.length !== 1 ? "sellers" : "seller"}
                        </div>
                    </div>
                </div>

                {/* ── Table ── */}
                <SectionCard 
                    title="Gavali Sellers" 
                    icon={<Users size={16} className="text-white" />}
                    data-tour="gavali-table"
                >
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : !registerData ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Gift size={32} />
                            <p className="text-sm">Select an event or date range to view sellers</p>
                        </div>
                    ) : paginatedSellers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Users size={32} />
                            <p className="text-sm">No Gavali sellers found for this period</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50/80 border-b border-gray-200/60 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 w-10">#</th>
                                        <th className="px-4 py-3 min-w-[130px]">Seller</th>
                                        <th className="px-4 py-3 text-right">Cow Qty (L)</th>
                                        <th className="px-4 py-3 text-right">Buffalo Qty (L)</th>
                                        <th className="px-4 py-3 text-right">Total Qty (L)</th>
                                        <th className="px-4 py-3 text-right">Bonus Amount</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-center">Paid At</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedSellers.map((seller, idx) => {
                                        const isOpen = expanded[seller.seller_id] || false;
                                        const isPaid = seller.is_paid || false;
                                        const monthlyData = monthlyBreakdown[seller.seller_id] || {};
                                        const months = Object.keys(monthlyData).sort();

                                        return (
                                            <React.Fragment key={seller.seller_id}>
                                                <tr className={`border-b border-gray-200/60 hover:bg-gray-50/50 transition ${isPaid ? 'bg-emerald-50/30' : ''}`}>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                        {idx + 1 + (currentPage - 1) * pageSize}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                                                ${isPaid ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm" : "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm"}`}>
                                                                {seller.name?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800 truncate">{seller.name}</p>
                                                                {seller.seller_code && <p className="text-[10px] text-gray-400">{seller.seller_code}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        {fmtQty(seller.cow_qty || 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        {fmtQty(seller.buffalo_qty || 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                                                        {fmtQty(seller.total_qty)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-amber-600">
                                                        {fmt(seller.total_bonus || 0)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {isPaid ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-emerald-200/60 bg-emerald-50/80 text-emerald-700">
                                                                <CheckCircle2 size={11} /> Paid
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-rose-200/60 bg-rose-50/80 text-rose-700">
                                                                <Clock size={11} /> Unpaid
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                        {isPaid ? fmtShort(seller.paid_at) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            {!isPaid && selectedEventId && can('gavali_bonus', 'W') && (
                                                                <button
                                                                    onClick={() => handleMarkPaid(seller.seller_id)}
                                                                    disabled={updating[seller.seller_id]}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 hover:shadow-lg hover:shadow-emerald-500/30 text-white text-[10px] font-semibold transition shadow-sm disabled:opacity-40"
                                                                >
                                                                    {updating[seller.seller_id] ? (
                                                                        <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                                    ) : (
                                                                        <CheckCircle2 size={10} />
                                                                    )}
                                                                    Mark Paid
                                                                </button>
                                                            )}
                                                            {isPaid && selectedEventId && can('gavali_bonus', 'W') && (
                                                                <button
                                                                    onClick={() => handleUndoPaid(seller.seller_id)}
                                                                    disabled={updating[seller.seller_id]}
                                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 text-[10px] font-semibold border border-rose-200/60 transition shadow-sm disabled:opacity-40"
                                                                >
                                                                    <RotateCcw size={10} /> Undo
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => toggleExpand(seller.seller_id)}
                                                                className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition shadow-sm"
                                                            >
                                                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded monthly breakdown */}
                                                {isOpen && (
                                                    <tr>
                                                        <td colSpan="9" className="px-4 py-4 bg-gray-50/60 border-t border-gray-200/60">
                                                            <div className="flex flex-col gap-2">
                                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                                    Monthly Breakdown
                                                                </p>
                                                                {loadingMonthly[seller.seller_id] ? (
                                                                    <div className="flex justify-center py-6">
                                                                        <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                                                                    </div>
                                                                ) : months.length === 0 ? (
                                                                    <p className="text-xs text-gray-400">No monthly data available for this period.</p>
                                                                ) : (
                                                                    <div className="rounded-xl border border-gray-200/60 bg-white/30 backdrop-blur-sm overflow-hidden shadow-sm">
                                                                        <div className="grid bg-gray-100/80 border-b border-gray-200/60"
                                                                            style={{ gridTemplateColumns: "120px 1fr 1fr 1fr" }}>
                                                                            <div className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Month</div>
                                                                            <div className="px-3 py-2 text-[10px] font-semibold text-amber-600 uppercase tracking-wide text-right">Cow Qty (L)</div>
                                                                            <div className="px-3 py-2 text-[10px] font-semibold text-blue-600 uppercase tracking-wide text-right">Buffalo Qty (L)</div>
                                                                            <div className="px-3 py-2 text-[10px] font-semibold text-gray-700 uppercase tracking-wide text-right">Total (L)</div>
                                                                        </div>
                                                                        {months.map(month => {
                                                                            const data = monthlyData[month];
                                                                            const cow = data?.cow_qty || 0;
                                                                            const buffalo = data?.buffalo_qty || 0;
                                                                            const total = cow + buffalo;
                                                                            return (
                                                                                <div key={month} className="grid border-b border-gray-200/60 last:border-0 hover:bg-white/30 transition"
                                                                                    style={{ gridTemplateColumns: "120px 1fr 1fr 1fr" }}>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600 font-medium">
                                                                                        {new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-amber-700 font-mono text-right">
                                                                                        {fmtQty(cow)}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-blue-700 font-mono text-right">
                                                                                        {fmtQty(buffalo)}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs font-semibold text-gray-800 text-right">
                                                                                        {fmtQty(total)}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                        <div className="grid bg-gray-100/80 border-t border-gray-200/60 font-semibold"
                                                                            style={{ gridTemplateColumns: "120px 1fr 1fr 1fr" }}>
                                                                            <div className="px-3 py-2 text-xs text-gray-600">Total</div>
                                                                            <div className="px-3 py-2 text-xs text-amber-700 text-right">
                                                                                {fmtQty(months.reduce((sum, m) => sum + (monthlyData[m]?.cow_qty || 0), 0))}
                                                                            </div>
                                                                            <div className="px-3 py-2 text-xs text-blue-700 text-right">
                                                                                {fmtQty(months.reduce((sum, m) => sum + (monthlyData[m]?.buffalo_qty || 0), 0))}
                                                                            </div>
                                                                            <div className="px-3 py-2 text-xs text-gray-800 text-right">
                                                                                {fmtQty(months.reduce((sum, m) => sum + (monthlyData[m]?.cow_qty || 0) + (monthlyData[m]?.buffalo_qty || 0), 0))}
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
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-t border-gray-200/60 bg-gray-50/60 rounded-b-xl">
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm"
                                >
                                    Prev
                                </button>
                                <span className="text-xs text-gray-600">
                                    Page {currentPage} of {totalPages}
                                </span>
                                <button 
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                                    disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm"
                                >
                                    Next
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">Rows per page:</span>
                                <select 
                                    value={pageSize} 
                                    onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                                    className="border border-gray-200/60 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                                >
                                    {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </SectionCard>

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• <strong className="text-gray-600">{registerData?.sellers?.length || 0}</strong> total Gavali sellers</span>
                    <span>• <span className="text-emerald-600 font-semibold">Paid</span> — bonus has been disbursed</span>
                    <span>• <span className="text-rose-600 font-semibold">Unpaid</span> — bonus pending</span>
                    <span>• Click <ChevronDown size={11} className="inline" /> to see monthly breakdown</span>
                </div>

            </main>
        </div>
    );
}