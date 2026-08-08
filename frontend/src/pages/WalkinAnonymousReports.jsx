// src/pages/admin/WalkinAnonymousReports.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    BarChart3, Download, Search, Calendar,
    DollarSign, Clock, AlertTriangle, X,
    Users, TrendingUp, BadgeCheck, ArrowUpDown, Milk, FileText
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

// ── Main Component ────────────────────────────────────────────
export default function WalkinAnonymousReports() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── Raw data ─────────────────────────────────────────────────
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // ── Date range ────────────────────────────────────────────────
    const [dateRange, setDateRange] = useState({ from: today(), to: today() });
    const [rangeMode, setRangeMode] = useState("daily");
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // ── Search / sort / pagination ──────────────────────────────
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState("date");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const [flash, setFlash] = useState(null);
    const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 3500); };

    // ── Tour ─────────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="anon-date-filters"]',
                    popover: {
                        title: t('anonymousReport.tour.filters.title'),
                        description: t('anonymousReport.tour.filters.description'),
                    },
                },
                {
                    element: '[data-tour="anon-stats"]',
                    popover: {
                        title: t('anonymousReport.tour.stats.title'),
                        description: t('anonymousReport.tour.stats.description'),
                    },
                },
                {
                    element: '[data-tour="anon-table"]',
                    popover: {
                        title: t('anonymousReport.tour.table.title'),
                        description: t('anonymousReport.tour.table.description'),
                    },
                },
            ],
        });
        driverObj.drive();
    };

    // ── API calls ────────────────────────────────────────────────
    const fetchSales = async (from, to) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/walkin-sales?from=${from}&to=${to}`);
            const anon = data.filter(s => !s.buyer_id && !s.seller_id);
            setSales(anon);
        } catch (err) {
            console.error("Failed to fetch anonymous sales:", err);
            showFlash("error", t('anonymousReport.fetchError'));
            setSales([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchAll = (from, to) => {
        fetchSales(from, to);
    };

    useEffect(() => {
        fetchAll(dateRange.from, dateRange.to);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Date range change ──────────────────────────────────────
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
        } else if (mode === "yearly") {
            const year = selectedYear;
            from = `${year}-01-01`;
            to = `${year}-12-31`;
        }
        setDateRange({ from, to });
        fetchAll(from, to);
    };

    // When year changes in yearly mode, update range
    useEffect(() => {
        if (rangeMode === "yearly") {
            const from = `${selectedYear}-01-01`;
            const to = `${selectedYear}-12-31`;
            setDateRange({ from, to });
            fetchAll(from, to);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedYear]);

    // ── Filter + sort + paginate ─────────────────────────────────
    const filteredSales = useMemo(() => {
        let rows = sales.filter(s => {
            const matchSearch = !search.trim() ||
                String(s.sale_id).includes(search) ||
                (s.shift || "").toLowerCase().includes(search.toLowerCase()) ||
                (s.milk_type || "").toLowerCase().includes(search.toLowerCase());
            return matchSearch;
        });

        rows.sort((a, b) => {
            if (sortBy === "date") return new Date(a.sale_date) - new Date(b.sale_date);
            if (sortBy === "qty") return parseFloat(b.quantity || 0) - parseFloat(a.quantity || 0);
            if (sortBy === "amount") return parseFloat(b.total_amount || 0) - parseFloat(a.total_amount || 0);
            return 0;
        });
        return rows;
    }, [sales, search, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredSales.length / pageSize));
    const paginated = filteredSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ── Overall stats ─────────────────────────────────────────────
    const overall = useMemo(() => {
        const totalQty = sales.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0);
        const totalAmt = sales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0);
        const totalPaid = sales.reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0);
        const outstanding = totalAmt - totalPaid;
        return { totalQty, totalAmt, totalPaid, outstanding, count: sales.length };
    }, [sales]);

    // ── PDF export ────────────────────────────────────────────────
    const handleExportPDF = () => {
        const win = window.open("", "_blank", "width=1400,height=900");
        if (!win) { showFlash("error", t('anonymousReport.popupBlocked')); return; }

        const periodLabel = dateRange.from === dateRange.to ? fmtDate(dateRange.from) : `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`;
        const rows = filteredSales.map((s, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
                <td class="td-center">${i + 1}</td>
                <td class="td-center">${fmtDate(s.sale_date)}</td>
                <td>${s.shift || '—'}</td>
                <td>${s.milk_type || '—'}</td>
                <td class="td-right">${parseFloat(s.quantity || 0).toFixed(2)} L</td>
                <td class="td-right">${fmt(s.total_amount)}</td>
                <td class="td-right">${fmt(s.amount_paid)}</td>
                <td class="td-right">${fmt(parseFloat(s.total_amount || 0) - parseFloat(s.amount_paid || 0))}</td>
            </tr>`).join("");

        const grand = {
            qty: filteredSales.reduce((sum, s) => sum + parseFloat(s.quantity || 0), 0),
            total: filteredSales.reduce((sum, s) => sum + parseFloat(s.total_amount || 0), 0),
            paid: filteredSales.reduce((sum, s) => sum + parseFloat(s.amount_paid || 0), 0),
            bal: filteredSales.reduce((sum, s) => sum + (parseFloat(s.total_amount || 0) - parseFloat(s.amount_paid || 0)), 0),
        };

        win.document.write(`<!DOCTYPE html>
<html><head><title>${t('anonymousReport.pdf.title')} — ${periodLabel}</title>
<style>
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:10px; color:#111; margin:0; padding:16px; }
  .report-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; padding-bottom:10px; border-bottom:3px double #1e3a8a; gap:12px; flex-wrap:wrap; }
  .report-title { font-size:17px; font-weight:900; color:#1e3a8a; }
  .report-sub { font-size:9px; color:#475569; margin-top:3px; }
  .report-gen { font-size:8px; color:#94a3b8; text-align:right; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1px solid #e2e8f0; padding:5px 7px; white-space:nowrap; }
  thead th { background:#0f172a; color:#fff; font-size:8.5px; text-transform:uppercase; letter-spacing:0.3px; }
  .td-center { text-align:center; }
  .td-right { text-align:right; }
  .grand-row td { background:#1e293b; color:#fff; font-weight:800; font-size:9px; text-align:center; }
  .report-footer { margin-top:16px; display:flex; justify-content:space-between; align-items:flex-end; font-size:8px; color:#94a3b8; border-top:1px solid #e2e8f0; padding-top:10px; }
  .signatory-line { width:150px; border-top:1.5px solid #374151; margin-bottom:4px; }
  .signatory-label { color:#374151; font-size:9px; font-weight:600; }
  @media print { @page { margin:8mm; size:A4 landscape; } body { padding:0; } }
</style></head>
<body>
<div class="report-header">
  <div>
    <div class="report-title">${t('anonymousReport.pdf.title')}</div>
    <div class="report-sub">${periodLabel} · ${filteredSales.length} ${t('anonymousReport.pdf.transactions')}</div>
  </div>
  <div class="report-gen">${t('anonymousReport.pdf.generated')}: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
</div>
<table>
  <thead>
    <tr><th>#</th><th>${t('anonymousReport.pdf.date')}</th><th>${t('anonymousReport.pdf.shift')}</th><th>${t('anonymousReport.pdf.milkType')}</th><th>${t('anonymousReport.pdf.qty')}</th><th>${t('anonymousReport.pdf.totalAmt')}</th><th>${t('anonymousReport.pdf.paid')}</th><th>${t('anonymousReport.pdf.balance')}</th></tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="grand-row">
      <td colspan="4">${t('anonymousReport.pdf.grandTotal')}</td>
      <td>${grand.qty.toFixed(2)} L</td>
      <td>${fmt(grand.total)}</td>
      <td>${fmt(grand.paid)}</td>
      <td>${fmt(grand.bal)}</td>
    </tr>
  </tbody>
</table>
<div class="report-footer">
  <span>${t('anonymousReport.pdf.footer')} ${new Date().toLocaleString()}</span>
  <div style="text-align:center">
    <div class="signatory-line"></div>
    <span class="signatory-label">${t('anonymousReport.pdf.signatory')}</span>
  </div>
</div>
<script>window.onload = () => window.print();</script>
</body></html>`);
        win.document.close();
    };

    // ── Render ─────────────────────────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('walkin_sales', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md">
                            <BarChart3 size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">
                                {t('anonymousReport.title')}
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('anonymousReport.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={startTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> {t('anonymousReport.takeTour')}
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition"
                        >
                            <Download size={14} /> {t('anonymousReport.exportPDF')}
                        </button>
                    </div>
                </div>

                {/* Date Range + Year Filter */}
                <div className="flex items-center gap-3 flex-wrap" data-tour="anon-date-filters">
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            { v: "daily", l: t("payments.day") },
                            { v: "weekly", l: t("payments.week") },
                            { v: "monthly", l: t("payments.month") },
                            { v: "yearly", l: t('anonymousReport.rangeYear') },
                        ].map(({ v, l }) => (
                            <button key={v} type="button" onClick={() => handleDateRangeChange(v)}
                                className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    {/* Year dropdown – visible only in yearly mode */}
                    {rangeMode === "yearly" && (
                        <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-gray-400" />
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            >
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Custom date pickers (always visible) */}
                    <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-gray-400" />
                        <input type="date" value={dateRange.from}
                            onChange={(e) => {
                                const newFrom = e.target.value;
                                setRangeMode("custom");
                                setDateRange(prev => ({ ...prev, from: newFrom }));
                                fetchAll(newFrom, dateRange.to);
                            }}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                        <span className="text-gray-400 text-xs">→</span>
                        <input type="date" value={dateRange.to}
                            onChange={(e) => {
                                const newTo = e.target.value;
                                setRangeMode("custom");
                                setDateRange(prev => ({ ...prev, to: newTo }));
                                fetchAll(dateRange.from, newTo);
                            }}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="anon-stats">
                    <StatCard
                        label={t('anonymousReport.stats.totalMilk')}
                        value={`${overall.totalQty.toFixed(2)} L`}
                        icon={<Milk size={14} />}
                        color="text-violet-600 bg-violet-50 border-violet-100"
                    />
                    <StatCard
                        label={t('anonymousReport.stats.salesAmount')}
                        value={fmt(overall.totalAmt)}
                        icon={<TrendingUp size={14} />}
                        color="text-blue-600 bg-blue-50 border-blue-100"
                    />
                    <StatCard
                        label={t('anonymousReport.stats.amountPaid')}
                        value={fmt(overall.totalPaid)}
                        icon={<DollarSign size={14} />}
                        color="text-emerald-600 bg-emerald-50 border-emerald-100"
                    />
                    <StatCard
                        label={t('anonymousReport.stats.outstanding')}
                        value={fmt(overall.outstanding)}
                        sub={t('anonymousReport.stats.outstandingSub', { count: overall.count })}
                        icon={<Clock size={14} />}
                        color="text-rose-600 bg-rose-50 border-rose-100"
                    />
                </div>

                {/* Search + Sort */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder={t('anonymousReport.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                        <ArrowUpDown size={12} className="text-gray-400" />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition">
                            <option value="date">{t('anonymousReport.sort.date')}</option>
                            <option value="qty">{t('anonymousReport.sort.qty')}</option>
                            <option value="amount">{t('anonymousReport.sort.amount')}</option>
                        </select>
                    </div>

                    <span className="ml-auto text-xs text-gray-400">
                        {t('anonymousReport.saleCount', { count: filteredSales.length })}
                    </span>
                </div>

                {/* Sales Table – no expand, no actions */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-tour="anon-table">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <FileText size={32} />
                            <p className="text-sm">{t('anonymousReport.noSales')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 w-10">#</th>
                                        <th className="px-4 py-3 min-w-[90px]">{t('anonymousReport.table.date')}</th>
                                        <th className="px-4 py-3">{t('anonymousReport.table.shift')}</th>
                                        <th className="px-4 py-3">{t('anonymousReport.table.milkType')}</th>
                                        <th className="px-4 py-3 text-right">{t('anonymousReport.table.qty')}</th>
                                        <th className="px-4 py-3 text-right">{t('anonymousReport.table.totalAmt')}</th>
                                        <th className="px-4 py-3 text-right">{t('anonymousReport.table.paid')}</th>
                                        <th className="px-4 py-3 text-right">{t('anonymousReport.table.balance')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((sale, idx) => {
                                        const outstanding = parseFloat(sale.total_amount || 0) - parseFloat(sale.amount_paid || 0);
                                        return (
                                            <tr key={sale.sale_id} className="border-b border-gray-100 hover:bg-gray-50/50 transition">
                                                <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                    {idx + 1 + (currentPage - 1) * pageSize}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                                    {fmtShort(sale.sale_date)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">{sale.shift || '—'}</td>
                                                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{sale.milk_type || '—'}</td>
                                                <td className="px-4 py-3 text-right font-mono text-sm">
                                                    {parseFloat(sale.quantity || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-semibold text-gray-700">
                                                    {fmt(sale.total_amount)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-emerald-600">
                                                    {fmt(sale.amount_paid)}
                                                </td>
                                                <td className={`px-4 py-3 text-right font-bold ${outstanding > 0.01 ? "text-rose-600" : "text-emerald-600"}`}>
                                                    {outstanding > 0.01 ? fmt(outstanding) : "✓"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {filteredSales.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-t border-gray-200 bg-gray-50/80">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                    {t("payments.prev")}
                                </button>
                                <span className="text-xs text-gray-600">{t("payments.page")} {currentPage} {t("payments.of")} {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                    {t("payments.next")}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{t("payments.rows_per_page")}:</span>
                                <select value={pageSize} onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition">
                                    {[10, 25, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}