// src/pages/admin/WalkinNamedBuyerReports.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    BarChart3, Download, Search, Calendar,
    DollarSign, Clock, AlertTriangle, X, Users, TrendingUp,
    BadgeCheck, ArrowUpDown, Milk, ChevronDown, ChevronUp,
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
export default function WalkinNamedBuyerReports() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── Raw data ─────────────────────────────────────────────────
    const [buyers, setBuyers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // ── Date range ────────────────────────────────────────────────
    const [dateRange, setDateRange] = useState(() => {
        const d = new Date();
        const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
        return { from, to: today() };
    });
    const [rangeMode, setRangeMode] = useState("monthly");
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // ── Search / filter / sort / pagination ─────────────────────
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [sortBy, setSortBy] = useState("outstanding");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ── Expand / statement ──────────────────────────────────────
    const [expanded, setExpanded] = useState({});
    const [statementMap, setStatementMap] = useState({});
    const [loadingStatement, setLoadingStatement] = useState({});

    const [flash, setFlash] = useState(null);
    const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 3500); };

    // ── Custom undo modal state ─────────────────────────────────
    const [undoModal, setUndoModal] = useState({ open: false, buyerId: null, paymentId: null });
    const [processingUndo, setProcessingUndo] = useState(false);

    // ── Tour ─────────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="buyer-date-filters"]',
                    popover: {
                        title: t('namedBuyerReport.tour.filters.title'),
                        description: t('namedBuyerReport.tour.filters.description'),
                    },
                },
                {
                    element: '[data-tour="buyer-stats"]',
                    popover: {
                        title: t('namedBuyerReport.tour.stats.title'),
                        description: t('namedBuyerReport.tour.stats.description'),
                    },
                },
                {
                    element: '[data-tour="buyer-table"]',
                    popover: {
                        title: t('namedBuyerReport.tour.table.title'),
                        description: t('namedBuyerReport.tour.table.description'),
                    },
                },
            ],
        });
        driverObj.drive();
    };

    // ── API calls ────────────────────────────────────────────────
    const fetchBuyers = async () => {
        try {
            const { data } = await api.get("/walkin-payments/buyers");
            setBuyers(data.filter(b => b.buyer_type === 'named'));
        } catch (err) {
            console.error("Failed to fetch named buyers:", err);
        }
    };

    const fetchPayments = async (from, to) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/walkin-payments/payments?from=${from}&to=${to}`);
            setPayments(data.filter(p => p.buyer_type === 'named' || p.buyer_id));
        } catch (err) {
            showFlash("error", t("payments.fetch_payments_failed"));
        } finally {
            setLoading(false);
        }
    };

    const fetchSales = async (from, to) => {
        try {
            const { data } = await api.get(`/walkin-sales?from=${from}&to=${to}`);
            setSales(data.filter(s => s.buyer_id && !s.seller_id));
        } catch (err) {
            console.error("Failed to fetch sales:", err);
            setSales([]);
        }
    };

    const fetchAll = (from, to) => {
        fetchBuyers();
        fetchPayments(from, to);
        fetchSales(from, to);
    };

    useEffect(() => {
        fetchAll(dateRange.from, dateRange.to);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // ── Per-buyer aggregation for the selected range ───────────
    const rangeAgg = useMemo(() => {
        const map = {};
        const ensure = (id) => {
            if (!map[id]) map[id] = { qty: 0, salesAmt: 0, paidTotal: 0, lastPaymentDate: null };
            return map[id];
        };
        sales.forEach(s => {
            const row = ensure(s.buyer_id);
            row.qty += parseFloat(s.quantity || 0);
            row.salesAmt += parseFloat(s.total_amount || 0);
        });
        payments.forEach(p => {
            const row = ensure(p.buyer_id);
            const amt = parseFloat(p.amount || 0);
            row.paidTotal += amt;
            const dk = String(p.payment_date || "").split("T")[0];
            if (!row.lastPaymentDate || dk > row.lastPaymentDate) row.lastPaymentDate = dk;
        });
        return map;
    }, [sales, payments]);

    // ── Combined buyer rows ─────────────────────────────────────
    const buyerRows = useMemo(() => {
        return buyers.map(b => {
            const agg = rangeAgg[b.buyer_id] || { qty: 0, salesAmt: 0, paidTotal: 0, lastPaymentDate: null };
            return {
                ...b,
                range_qty: agg.qty,
                range_sales_amt: agg.salesAmt,
                range_paid: agg.paidTotal,
                last_payment_date: agg.lastPaymentDate,
                outstanding_balance: parseFloat(b.outstanding_balance || 0),
                total_paid: parseFloat(b.total_paid || 0),
                total_purchases: parseFloat(b.total_purchases || 0),
            };
        });
    }, [buyers, rangeAgg]);

    // ── Filter + sort + paginate ─────────────────────────────────
    const filteredBuyers = useMemo(() => {
        let rows = buyerRows.filter(b => {
            const matchSearch = !search.trim() ||
                b.name.toLowerCase().includes(search.toLowerCase()) ||
                (b.mobile || "").includes(search);
            const hasOutstanding = b.outstanding_balance > 0.01;
            const matchStatus = filterStatus === "all" ? true :
                filterStatus === "outstanding" ? hasOutstanding : !hasOutstanding;
            return matchSearch && matchStatus;
        });

        rows.sort((a, b) => {
            if (sortBy === "name") return a.name.localeCompare(b.name);
            if (sortBy === "sales") return b.range_sales_amt - a.range_sales_amt;
            if (sortBy === "paid") return b.range_paid - a.range_paid;
            return b.outstanding_balance - a.outstanding_balance;
        });
        return rows;
    }, [buyerRows, search, filterStatus, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredBuyers.length / pageSize));
    const paginated = filteredBuyers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ── Overall stats ─────────────────────────────────────────────
    const overall = useMemo(() => {
        return {
            totalQty: sales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0),
            totalSalesAmt: sales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0),
            totalCollected: payments.reduce((a, p) => a + parseFloat(p.amount || 0), 0),
            totalOutstanding: buyers.reduce((a, b) => a + parseFloat(b.outstanding_balance || 0), 0),
            outstandingCount: buyers.filter(b => parseFloat(b.outstanding_balance || 0) > 0.01).length,
            activeBuyers: buyers.length,
        };
    }, [sales, payments, buyers]);

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
            from = `${selectedYear}-01-01`;
            to = `${selectedYear}-12-31`;
        }
        setDateRange({ from, to });
        fetchAll(from, to);
    };

    // ── Expand / buyer statement ─────────────────────────────────
    const buildStatement = async (buyer) => {
        setLoadingStatement(prev => ({ ...prev, [buyer.buyer_id]: true }));
        try {
            const [{ data: txPayments }, { data: rangeSales }] = await Promise.all([
                api.get(`/walkin-payments/buyer-payments/${buyer.buyer_id}?type=named`),
                api.get(`/walkin-sales?from=${dateRange.from}&to=${dateRange.to}`),
            ]);

            const buyerSales = rangeSales.filter(s => s.buyer_id === buyer.buyer_id && !s.seller_id);
            const buyerPayments = txPayments.filter(p => {
                const dk = String(p.payment_date || "").split("T")[0];
                return dk >= dateRange.from && dk <= dateRange.to;
            });

            const entries = [
                ...buyerSales.map(s => ({
                    type: "sale",
                    date: s.sale_date,
                    label: `${(s.milk_type || 'cow').toUpperCase()} · ${(s.shift || '—')}`,
                    qty: parseFloat(s.quantity || 0),
                    debit: parseFloat(s.total_amount || 0),
                    credit: 0,
                    payment_id: null,
                    payment_mode: null,
                    remarks: null,
                })),
                ...buyerPayments.map(p => ({
                    type: "payment",
                    date: p.payment_date,
                    label: t("payments.payment_recorded", "Payment"),
                    qty: null,
                    debit: 0,
                    credit: parseFloat(p.amount || 0),
                    payment_id: p.payment_id,
                    payment_mode: p.payment_mode,
                    remarks: p.remarks,
                })),
            ].sort((a, b) => new Date(a.date) - new Date(b.date));

            let running = 0;
            const withBalance = entries.map(e => {
                running += e.debit - e.credit;
                return { ...e, running_balance: running };
            });

            setStatementMap(prev => ({ ...prev, [buyer.buyer_id]: withBalance }));
        } catch (err) {
            console.error("Failed to build buyer statement:", err);
            setStatementMap(prev => ({ ...prev, [buyer.buyer_id]: [] }));
        } finally {
            setLoadingStatement(prev => ({ ...prev, [buyer.buyer_id]: false }));
        }
    };

    const toggleExpand = (buyer) => {
        const willOpen = !expanded[buyer.buyer_id];
        setExpanded(prev => ({ ...prev, [buyer.buyer_id]: willOpen }));
        if (willOpen) buildStatement(buyer);
    };

    // ── Undo payment with custom modal ──────────────────────────
    const confirmUndoPayment = (buyerId, paymentId) => {
        setUndoModal({ open: true, buyerId, paymentId });
    };

    const handleConfirmUndo = async () => {
        const { buyerId, paymentId } = undoModal;
        if (!buyerId || !paymentId) return;
        setProcessingUndo(true);
        try {
            await api.delete(`/walkin-payments/payments/${paymentId}`);
            showFlash("success", t("payments.payment_undone_success"));
            await fetchAll(dateRange.from, dateRange.to);
            if (expanded[buyerId]) {
                const buyer = buyers.find(b => b.buyer_id === buyerId);
                if (buyer) buildStatement(buyer);
            }
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.undo_payment_failed"));
        } finally {
            setProcessingUndo(false);
            setUndoModal({ open: false, buyerId: null, paymentId: null });
        }
    };

    // ── PDF: consolidated named buyer report ──────────────────────
    const handleExportPDF = () => {
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) { showFlash("error", t('namedBuyerReport.popupBlocked')); return; }

        const modeLabel = rangeMode === "daily" ? t("payments.daily") :
            rangeMode === "weekly" ? t("payments.weekly") :
                rangeMode === "monthly" ? t("payments.monthly") :
                    rangeMode === "yearly" ? t('namedBuyerReport.rangeYear') :
                        t("payments.custom");
        const periodLabel = dateRange.from === dateRange.to ? fmtDate(dateRange.from) : `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`;

        const rows = filteredBuyers.map((b, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
                <td class="td-no">${i + 1}</td>
                <td class="td-name">
                    <div class="name-full">${b.name}</div>
                    ${b.mobile ? `<div class="name-sub">${b.mobile}</div>` : ""}
                </td>
                <td class="td-num">${b.range_qty > 0 ? b.range_qty.toFixed(2) + " L" : "—"}</td>
                <td class="td-num td-bold">${b.range_sales_amt > 0 ? fmt(b.range_sales_amt) : "—"}</td>
                <td class="td-num td-bold" style="color:#1d4ed8">${b.range_paid > 0 ? fmt(b.range_paid) : "—"}</td>
                <td class="td-num td-bold" style="color:${b.outstanding_balance > 0.01 ? '#b91c1c' : '#15803d'}">
                    ${b.outstanding_balance > 0.01 ? fmt(b.outstanding_balance) : t('namedBuyerReport.pdf.nil')}
                </td>
                <td class="td-center">${b.last_payment_date ? fmtShort(b.last_payment_date) : "—"}</td>
            </tr>`).join("");

        const grand = {
            qty: filteredBuyers.reduce((a, b) => a + b.range_qty, 0),
            salesAmt: filteredBuyers.reduce((a, b) => a + b.range_sales_amt, 0),
            paid: filteredBuyers.reduce((a, b) => a + b.range_paid, 0),
            outstanding: filteredBuyers.reduce((a, b) => a + b.outstanding_balance, 0),
        };

        win.document.write(`<!DOCTYPE html>
<html><head><title>${t('namedBuyerReport.pdf.title')} — ${periodLabel}</title>
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
    <div class="report-title">${t('namedBuyerReport.pdf.title')}</div>
    <div class="report-sub">${t('namedBuyerReport.pdf.period', { mode: modeLabel, period: periodLabel, count: filteredBuyers.length })}</div>
  </div>
  <div class="report-gen">${t('namedBuyerReport.pdf.generated')}: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
  <div class="badges">
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
      <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase">${t('namedBuyerReport.pdf.collected')}</div>
      <div style="font-size:12px;font-weight:900;color:#15803d">${fmt(overall.totalCollected)}</div>
    </div>
    <div style="background:#fee2e2;border:1.5px solid #fca5a5;padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
      <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase">${t('namedBuyerReport.pdf.outstanding')}</div>
      <div style="font-size:12px;font-weight:900;color:#b91c1c">${fmt(overall.totalOutstanding)}</div>
    </div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th style="text-align:left">${t('namedBuyerReport.table.buyer')}</th><th>${t('namedBuyerReport.table.qty')}</th><th>${t('namedBuyerReport.table.purchaseAmt')}</th>
      <th>${t('namedBuyerReport.table.totalPaid')}</th><th>${t('namedBuyerReport.table.balance')}</th><th>${t('namedBuyerReport.table.lastPaid')}</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="grand-row">
      <td colspan="2">${t('namedBuyerReport.pdf.grandTotal')}</td>
      <td>${grand.qty.toFixed(2)} L</td>
      <td>${fmt(grand.salesAmt)}</td>
      <td>${fmt(grand.paid)}</td>
      <td>${fmt(grand.outstanding)}</td>
      <td>—</td>
    </tr>
  </tbody>
</table>
<div class="report-footer">
  <span>${t('namedBuyerReport.pdf.footer')} ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
  <div style="text-align:center">
    <div class="signatory-line"></div>
    <span class="signatory-label">${t('namedBuyerReport.pdf.signatory')}</span>
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

    if (!can('walkin_payments', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('namedBuyerReport.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('namedBuyerReport.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={startTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('namedBuyerReport.takeTour')}
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200"
                        >
                            <Download size={16} /> {t('namedBuyerReport.exportPDF')}
                        </button>
                    </div>
                </div>

                {/* ── Date Range + Year Filter ── */}
                <div className="flex items-center gap-3 flex-wrap" data-tour="buyer-date-filters">
                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            { v: "daily", l: t("payments.day") },
                            { v: "weekly", l: t("payments.week") },
                            { v: "monthly", l: t("payments.month") },
                            { v: "yearly", l: t('namedBuyerReport.rangeYear') },
                        ].map(({ v, l }) => (
                            <button key={v} type="button" onClick={() => handleDateRangeChange(v)}
                                className={`px-3.5 py-2 transition-all duration-200 ${rangeMode === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "text-gray-500 hover:bg-gray-100/50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    {/* Year dropdown – visible only in yearly mode */}
                    {rangeMode === "yearly" && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm">
                            <Calendar size={14} className="text-gray-400" />
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            >
                                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Custom date pickers (always visible) */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm">
                        <Calendar size={14} className="text-gray-400" />
                        <input type="date" value={dateRange.from}
                            onChange={(e) => {
                                const newFrom = e.target.value;
                                setRangeMode("custom");
                                setDateRange(prev => ({ ...prev, from: newFrom }));
                                fetchAll(newFrom, dateRange.to);
                            }}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition" />
                        <span className="text-gray-400 text-xs">→</span>
                        <input type="date" value={dateRange.to}
                            onChange={(e) => {
                                const newTo = e.target.value;
                                setRangeMode("custom");
                                setDateRange(prev => ({ ...prev, to: newTo }));
                                fetchAll(dateRange.from, newTo);
                            }}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition" />
                    </div>

                    {/* Period label */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-500 text-xs font-medium shadow-sm">
                        <span>{dateRange.from === dateRange.to ? fmtShort(dateRange.from) : `${fmtShort(dateRange.from)} — ${fmtShort(dateRange.to)}`}</span>
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success" ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700" : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={18} />}
                        {flash.type === "success" && <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-tour="buyer-stats">
                    <StatCard
                        label={t('namedBuyerReport.stats.milkPurchased')}
                        value={`${overall.totalQty.toFixed(2)} L`}
                        icon={<Milk size={16} />}
                        color="from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700"
                    />
                    <StatCard
                        label={t('namedBuyerReport.stats.purchaseAmount')}
                        value={fmt(overall.totalSalesAmt)}
                        icon={<TrendingUp size={16} />}
                        color="from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700"
                    />
                    <StatCard
                        label={t('namedBuyerReport.stats.amountCollected')}
                        value={fmt(overall.totalCollected)}
                        icon={<DollarSign size={16} />}
                        color="from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700"
                    />
                    <StatCard
                        label={t('namedBuyerReport.stats.totalOutstanding')}
                        value={fmt(overall.totalOutstanding)}
                        sub={t('namedBuyerReport.stats.outstandingSub', {
                            count: overall.outstandingCount,
                            total: overall.activeBuyers,
                        })}
                        icon={<Clock size={16} />}
                        color="from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600"
                    />
                </div>

                {/* ── Search + Filter + Sort ── */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder={t('namedBuyerReport.searchPlaceholder')}
                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition placeholder:text-gray-300"
                        />
                    </div>

                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            ["all", t("payments.all")],
                            ["outstanding", t("payments.outstanding")],
                            ["cleared", t("payments.cleared")],
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => { setFilterStatus(v); setCurrentPage(1); }}
                                className={`px-3.5 py-2 transition-all duration-200 border-r last:border-r-0 border-gray-200/60
                                    ${filterStatus === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "text-gray-500 hover:bg-gray-100/50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm text-xs">
                        <ArrowUpDown size={14} className="text-gray-400" />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition">
                            <option value="outstanding">{t('namedBuyerReport.sort.outstanding')}</option>
                            <option value="sales">{t('namedBuyerReport.sort.purchaseAmount')}</option>
                            <option value="paid">{t('namedBuyerReport.sort.paid')}</option>
                            <option value="name">{t('namedBuyerReport.sort.name')}</option>
                        </select>
                    </div>

                    <span className="ml-auto text-xs text-gray-400">
                        {t('namedBuyerReport.buyerCount', { count: filteredBuyers.length })}
                    </span>
                </div>

                {/* ── Buyer Table ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden" data-tour="buyer-table">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                            <Users size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">{t('namedBuyerReport.noBuyers')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                                        <th className="px-4 py-3 w-10 border-r border-gray-200/60">#</th>
                                        <th className="px-4 py-3 min-w-[130px] border-r border-gray-200/60">{t('namedBuyerReport.table.buyer')}</th>
                                        <th className="px-4 py-3 text-right border-r border-gray-200/60">{t('namedBuyerReport.table.qty')}</th>
                                        <th className="px-4 py-3 text-right border-r border-gray-200/60">{t('namedBuyerReport.table.purchaseAmt')}</th>
                                        <th className="px-4 py-3 text-right border-r border-gray-200/60">{t('namedBuyerReport.table.totalPaid')}</th>
                                        <th className="px-4 py-3 text-right border-r border-gray-200/60">{t('namedBuyerReport.table.balance')}</th>
                                        <th className="px-4 py-3 text-center border-r border-gray-200/60">{t('namedBuyerReport.table.lastPaid')}</th>
                                        <th className="px-4 py-3 text-center">{t('namedBuyerReport.table.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((buyer, idx) => {
                                        const hasOutstanding = buyer.outstanding_balance > 0.01;
                                        const isOpen = expanded[buyer.buyer_id];
                                        const entries = statementMap[buyer.buyer_id] || [];

                                        return (
                                            <React.Fragment key={buyer.buyer_id}>
                                                {/* Main row */}
                                                <tr
                                                    className={`border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors ${hasOutstanding ? 'bg-rose-50/20' : ''}`}
                                                >
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400 border-r border-gray-100/60">
                                                        {idx + 1 + (currentPage - 1) * pageSize}
                                                    </td>
                                                    <td className="px-4 py-3 border-r border-gray-100/60">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-sm
                                                                ${hasOutstanding ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30" : "bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-violet-500/30"}`}>
                                                                {buyer.name?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800 truncate">{buyer.name}</p>
                                                                {buyer.mobile && <p className="text-[10px] text-gray-400">{buyer.mobile}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm text-blue-600 border-r border-gray-100/60">
                                                        {buyer.range_qty > 0 ? buyer.range_qty.toFixed(2) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-gray-700 border-r border-gray-100/60">
                                                        {buyer.range_sales_amt > 0 ? fmt(buyer.range_sales_amt) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-blue-600 border-r border-gray-100/60">
                                                        {buyer.range_paid > 0 ? fmt(buyer.range_paid) : "—"}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-bold border-r border-gray-100/60 ${hasOutstanding ? "text-rose-600" : "text-emerald-600"}`}>
                                                        {hasOutstanding ? fmt(buyer.outstanding_balance) : "✓ " + t('namedBuyerReport.nil')}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400 border-r border-gray-100/60">
                                                        {buyer.last_payment_date ? fmtShort(buyer.last_payment_date) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <button
                                                            onClick={() => toggleExpand(buyer)}
                                                            className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm shadow-sm"
                                                        >
                                                            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* ── Expanded statement row ── */}
                                                {isOpen && (
                                                    <tr>
                                                        <td colSpan="8" className="px-4 py-4 bg-gray-50/50 backdrop-blur-sm border-t border-gray-200/60">
                                                            <div className="flex flex-col gap-3">
                                                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                                    {t('namedBuyerReport.statement.label', {
                                                                        from: fmtShort(dateRange.from),
                                                                        to: fmtShort(dateRange.to)
                                                                    })}
                                                                </p>

                                                                {loadingStatement[buyer.buyer_id] ? (
                                                                    <div className="flex justify-center py-6">
                                                                        <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                                                    </div>
                                                                ) : entries.length === 0 ? (
                                                                    <p className="text-xs text-gray-400 py-2">{t('namedBuyerReport.statement.noTransactions')}</p>
                                                                ) : (
                                                                    <div className="rounded-xl border border-gray-200/60 overflow-hidden overflow-x-auto shadow-sm bg-white/50 backdrop-blur-sm">
                                                                        <div className="min-w-[640px]">
                                                                            <div className="grid bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60"
                                                                                style={{ gridTemplateColumns: "90px 1fr 80px 100px 100px 110px 80px" }}>
                                                                                {[
                                                                                    t('namedBuyerReport.statement.headers.date'),
                                                                                    t('namedBuyerReport.statement.headers.description'),
                                                                                    t('namedBuyerReport.statement.headers.qty'),
                                                                                    t('namedBuyerReport.statement.headers.purchaseAmt'),
                                                                                    t('namedBuyerReport.statement.headers.paid'),
                                                                                    t('namedBuyerReport.statement.headers.balance'),
                                                                                    "",
                                                                                ].map(h => (
                                                                                    <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">{h}</div>
                                                                                ))}
                                                                            </div>
                                                                            {entries.map((e, i) => (
                                                                                <div key={i} className="grid border-b border-gray-100/60 last:border-0 hover:bg-white/50 transition"
                                                                                    style={{ gridTemplateColumns: "90px 1fr 80px 100px 100px 110px 80px" }}>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100/60">{fmtShort(e.date)}</div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-700 border-r border-gray-100/60">
                                                                                        {e.type === 'sale' ? e.label : (
                                                                                            <span className="flex items-center gap-1.5">
                                                                                                <span className="text-xs font-medium text-gray-500">{t("payments.payment_recorded", "Payment")}</span>
                                                                                                {e.remarks && <span className="text-gray-400 truncate">· {e.remarks}</span>}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-500 font-mono border-r border-gray-100/60">{e.qty != null ? e.qty.toFixed(2) : "—"}</div>
                                                                                    <div className="px-3 py-2 text-xs font-semibold text-rose-600 border-r border-gray-100/60">{e.debit > 0 ? fmt(e.debit) : "—"}</div>
                                                                                    <div className="px-3 py-2 text-xs font-semibold text-emerald-600 border-r border-gray-100/60">{e.credit > 0 ? fmt(e.credit) : "—"}</div>
                                                                                    <div className="px-3 py-2 text-xs font-bold text-gray-800 border-r border-gray-100/60">{fmt(e.running_balance)}</div>
                                                                                    <div className="px-3 py-2 flex items-center">
                                                                                        {e.type === 'payment' && (
                                                                                            <button
                                                                                                onClick={() => confirmUndoPayment(buyer.buyer_id, e.payment_id)}
                                                                                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold
                                                                                                    bg-rose-50/80 text-rose-600 border border-rose-200/60 backdrop-blur-sm
                                                                                                    hover:bg-rose-100/80 transition shadow-sm"
                                                                                            >
                                                                                                <X size={10} />
                                                                                                {t("payments.undo")}
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            ))}
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
                    {filteredBuyers.length > 0 && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-t border-gray-200/60 bg-white/50 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                                    {t("payments.prev")}
                                </button>
                                <span className="text-xs text-gray-600">{t("payments.page")} {currentPage} {t("payments.of")} {totalPages}</span>
                                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                                    {t("payments.next")}
                                </button>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400">{t("payments.rows_per_page")}:</span>
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
                    <span>· {t('namedBuyerReport.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('namedBuyerReport.footerBuyers', { defaultValue: 'Total buyers' })}: <strong className="text-gray-600">{buyers.length}</strong></span>
                    <span>· {t('namedBuyerReport.footerOutstanding', { defaultValue: 'With outstanding' })}: <strong className="text-rose-600">{overall.outstandingCount}</strong></span>
                </div>

            </main>

            {/* ── Undo Payment Confirmation Modal ── */}
            {undoModal.open && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-14 h-14 rounded-full bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shadow-sm">
                                <X size={24} className="text-rose-500" />
                            </div>
                            <h2 className="text-gray-800 font-bold text-base">Undo Payment</h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                {t("payments.undo_payment_confirm")}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => setUndoModal({ open: false, buyerId: null, paymentId: null })}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                                disabled={processingUndo}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmUndo}
                                disabled={processingUndo}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 active:scale-95"
                            >
                                {processingUndo
                                    ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                    : "Yes, Undo"
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}