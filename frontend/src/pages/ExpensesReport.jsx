// pages/common/ExpensesReport.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Receipt, Wallet, CheckCircle2, Circle, Layers,
    Calendar, Download, FileText, Building2, CreditCard, Hash,
    AlertTriangle, BadgeCheck, X, PieChart, TrendingUp,
    Home
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtCurrency = (v) => "₹" + parseFloat(v || 0).toFixed(2);

const getWeekRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const day = dt.getDay();
    const monOffset = day === 0 ? -6 : 1 - day;
    const mon = new Date(dt);
    mon.setDate(dt.getDate() + monOffset);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
};

const getMonthRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const y = dt.getFullYear(), m = dt.getMonth();
    return {
        from: new Date(y, m, 1).toISOString().split("T")[0],
        to: new Date(y, m + 1, 0).toISOString().split("T")[0],
    };
};

const getYearRange = (d) => {
    const dt = new Date(d + "T00:00:00");
    const y = dt.getFullYear();
    return {
        from: new Date(y, 0, 1).toISOString().split("T")[0],
        to: new Date(y, 11, 31).toISOString().split("T")[0],
    };
};

const applyRange = (mode, anchorDate) => {
    if (mode === "daily") return { from: anchorDate, to: anchorDate };
    if (mode === "weekly") return getWeekRange(anchorDate);
    if (mode === "monthly") return getMonthRange(anchorDate);
    if (mode === "yearly") return getYearRange(anchorDate);
    return null;
};

// ── StatCard ──────────────────────────────────────────────────
function StatCard({ label, value, icon, color }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color} bg-white/60 backdrop-blur-sm shadow-sm`}>
            <div className="shrink-0">{icon}</div>
            <div>
                <p className="text-xs text-gray-400 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

// ── Main Component ──────────────────────────────────────────────
export default function ExpensesReport() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── State ──
    const [rangeMode, setRangeMode] = useState("daily");
    const [selectedDate, setSelectedDate] = useState(today());
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());

    const [summary, setSummary] = useState(null);
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [flash, setFlash] = useState(null);

    // ── Helpers for translations of mode and status ──
    const getModeLabel = (mode) => {
        const map = {
            cash: t('expenses.paymentModeCash'),
            card: t('expenses.paymentModeCard'),
            upi: t('expenses.paymentModeUpi'),
        };
        return map[mode] || mode;
    };

    const getStatusLabel = (status) => {
        const map = {
            paid: t('expenses.statusPaid'),
            unpaid: t('expenses.statusUnpaid'),
        };
        return map[status] || status;
    };

    // ── Flash ──
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Fetch data ──
    const fetchData = async (from, to) => {
        setLoading(true);
        try {
            const [summaryRes, entriesRes] = await Promise.all([
                api.get(`/expenses/summary?from=${from}&to=${to}`),
                api.get(`/expenses?from=${from}&to=${to}`),
            ]);
            setSummary(summaryRes.data);
            setEntries(entriesRes.data);
        } catch (err) {
            showFlash("error", t('expensesReport.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData(fromDate, toDate);
    }, [fromDate, toDate]);

    // ── Range handlers ──
    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        const r = applyRange(mode, selectedDate);
        if (r) { setFromDate(r.from); setToDate(r.to); }
    };

    const handleDateChange = (d) => {
        setSelectedDate(d);
        const r = applyRange(rangeMode, d);
        if (r) { setFromDate(r.from); setToDate(r.to); }
    };

    // ── Compute breakdowns ──
    const totalAmount = entries.reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const paidAmount = entries.filter(e => e.payment_status === "paid").reduce((a, e) => a + parseFloat(e.amount || 0), 0);
    const unpaidAmount = entries.filter(e => e.payment_status === "unpaid").reduce((a, e) => a + parseFloat(e.amount || 0), 0);

    const modeBreakdown = entries.reduce((acc, e) => {
        const mode = e.payment_mode || "cash";
        acc[mode] = (acc[mode] || 0) + parseFloat(e.amount || 0);
        return acc;
    }, {});

    const statusBreakdown = {
        paid: paidAmount,
        unpaid: unpaidAmount,
    };

    // ── PDF Generation ──
    const generatePDF = () => {
        const doc = new jsPDF("p", "pt", "a4");
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(40);
        doc.text(t('expensesReport.pdfTitle'), pageWidth / 2, 50, { align: "center" });

        doc.setFontSize(11);
        doc.setTextColor(100);
        const dateRangeStr =
            fromDate === toDate
                ? fmtDate(fromDate)
                : `${fmtDate(fromDate)} – ${fmtDate(toDate)}`;
        doc.text(t('expensesReport.pdfPeriod', { period: dateRangeStr }), pageWidth / 2, 75, { align: "center" });

        // Summary cards
        const summaryData = [
            [t('expensesReport.totalExpenses'), fmtCurrency(totalAmount)],
            [t('expensesReport.paid'), fmtCurrency(paidAmount)],
            [t('expensesReport.unpaid'), fmtCurrency(unpaidAmount)],
            [t('expensesReport.entries'), entries.length],
        ];
        autoTable(doc, {
            startY: 100,
            body: summaryData,
            theme: "plain",
            styles: { fontSize: 10, cellPadding: 8 },
            columnStyles: { 0: { fontStyle: "bold", textColor: [80, 80, 80] } },
            margin: { left: 40, right: 40 },
        });

        // Breakdown by payment mode
        const modeRows = Object.entries(modeBreakdown).map(([mode, amount]) => [
            getModeLabel(mode),
            fmtCurrency(amount),
        ]);
        if (modeRows.length) {
            doc.text(t('expensesReport.pdfBreakdownMode'), 40, doc.lastAutoTable.finalY + 30);
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 40,
                head: [[t('expensesReport.mode'), t('expensesReport.amount')]],
                body: modeRows,
                theme: "striped",
                styles: { fontSize: 9 },
                headStyles: { fillColor: [50, 50, 50] },
                margin: { left: 40, right: 40 },
            });
        }

        // Breakdown by status
        const statusRows = Object.entries(statusBreakdown).map(([status, amount]) => [
            getStatusLabel(status),
            fmtCurrency(amount),
        ]);
        if (statusRows.length) {
            doc.text(t('expensesReport.pdfBreakdownStatus'), 40, doc.lastAutoTable.finalY + 30);
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 40,
                head: [[t('expensesReport.status'), t('expensesReport.amount')]],
                body: statusRows,
                theme: "striped",
                styles: { fontSize: 9 },
                headStyles: { fillColor: [50, 50, 50] },
                margin: { left: 40, right: 40 },
            });
        }

        // Detailed entries table
        if (entries.length) {
            doc.text(t('expensesReport.pdfDetailedEntries'), 40, doc.lastAutoTable.finalY + 30);
            const tableBody = entries.map(e => [
                fmtDate(e.expense_date),
                e.reason || "—",
                e.vendor_name || "—",
                e.bill_no || "—",
                getModeLabel(e.payment_mode || "cash"),
                getStatusLabel(e.payment_status || "paid"),
                fmtCurrency(e.amount),
            ]);
            autoTable(doc, {
                startY: doc.lastAutoTable.finalY + 40,
                head: [
                    [
                        t('expensesReport.date'),
                        t('expensesReport.reason'),
                        t('expensesReport.vendor'),
                        t('expensesReport.billNo'),
                        t('expensesReport.mode'),
                        t('expensesReport.status'),
                        t('expensesReport.amount'),
                    ]
                ],
                body: tableBody,
                theme: "striped",
                styles: { fontSize: 8 },
                headStyles: { fillColor: [50, 50, 50] },
                margin: { left: 40, right: 40 },
                columnStyles: {
                    0: { cellWidth: 70 },
                    1: { cellWidth: "auto" },
                    2: { cellWidth: "auto" },
                    3: { cellWidth: 60 },
                    4: { cellWidth: 50 },
                    5: { cellWidth: 50 },
                    6: { cellWidth: 70 },
                },
            });
        }

        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text(
                t('expensesReport.pdfGenerated', {
                    date: new Date().toLocaleString(),
                    page: i,
                    total: pageCount,
                }),
                pageWidth / 2,
                doc.internal.pageSize.getHeight() - 20,
                { align: "center" }
            );
        }

        doc.save(`Expenses_Report_${fromDate}_to_${toDate}.pdf`);
    };

    // ── Permissions ──
    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('expenses', 'R')) return <AccessDenied />;

    // ── Render ──
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('expensesReport.title')}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <PieChart size={12} /> Report
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('expensesReport.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('expensesReport.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('expensesReport.anchorDate')}</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="border border-gray-200/60 rounded-xl px-4 py-2.5 text-sm text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('expensesReport.period')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                    {[
                                        { v: "daily", l: t('expensesReport.periodDay') },
                                        { v: "weekly", l: t('expensesReport.periodWeek') },
                                        { v: "monthly", l: t('expensesReport.periodMonth') },
                                        { v: "yearly", l: t('expensesReport.periodYear') },
                                        { v: "custom", l: t('expensesReport.periodCustom') },
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button"
                                            onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition-all duration-200 ${rangeMode === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/60 backdrop-blur-sm text-gray-400 hover:bg-gray-50/80"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate}
                                            onChange={e => setFromDate(e.target.value)}
                                            className="border border-gray-200/60 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate}
                                            onChange={e => setToDate(e.target.value)}
                                            className="border border-gray-200/60 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-white/60 backdrop-blur-sm border border-gray-200/60 rounded-xl whitespace-nowrap hidden sm:inline shadow-sm">
                                        {fromDate === toDate
                                            ? fmtDate(fromDate)
                                            : `${fmtDate(fromDate)} → ${fmtDate(toDate)}`}
                                    </span>
                                )}
                            </div>
                        </div>
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

                {/* ── Summary Cards ── */}
                {!loading && summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <StatCard
                            label={t('expensesReport.totalExpenses')}
                            value={fmtCurrency(summary.total_amount)}
                            icon={<Wallet size={14} className="text-blue-600" />}
                            color="text-blue-600 bg-blue-50/80 border-blue-200/60"
                        />
                        <StatCard
                            label={t('expensesReport.paid')}
                            value={fmtCurrency(summary.paid_amount)}
                            icon={<CheckCircle2 size={14} className="text-emerald-600" />}
                            color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60"
                        />
                        <StatCard
                            label={t('expensesReport.unpaid')}
                            value={fmtCurrency(summary.unpaid_amount)}
                            icon={<Circle size={14} className="text-rose-600" />}
                            color="text-rose-600 bg-rose-50/80 border-rose-200/60"
                        />
                        <StatCard
                            label={t('expensesReport.entries')}
                            value={summary.total_entries}
                            icon={<Layers size={14} className="text-violet-600" />}
                            color="text-violet-600 bg-violet-50/80 border-violet-200/60"
                        />
                    </div>
                )}

                {/* ── Breakdowns ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Payment Mode Breakdown */}
                    <SectionCard
                        title={t('expensesReport.paymentModes')}
                        icon={<CreditCard size={16} className="text-white" />}
                    >
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(modeBreakdown).map(([mode, amount]) => (
                                    <div key={mode} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50/50 transition">
                                        <span className="text-sm capitalize text-gray-700">{getModeLabel(mode)}</span>
                                        <span className="text-sm font-semibold text-gray-900">{fmtCurrency(amount)}</span>
                                    </div>
                                ))}
                                {Object.keys(modeBreakdown).length === 0 && (
                                    <p className="text-sm text-gray-400">{t('expensesReport.noData')}</p>
                                )}
                            </div>
                        )}
                    </SectionCard>

                    {/* Payment Status Breakdown */}
                    <SectionCard
                        title={t('expensesReport.paymentStatus')}
                        icon={<CheckCircle2 size={16} className="text-white" />}
                    >
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(statusBreakdown).map(([status, amount]) => (
                                    <div key={status} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50/50 transition">
                                        <span className="text-sm capitalize text-gray-700">{getStatusLabel(status)}</span>
                                        <span className="text-sm font-semibold text-gray-900">{fmtCurrency(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </SectionCard>
                </div>

                {/* ── Entries Table ── */}
                <SectionCard
                    title={t('expensesReport.detailedEntries')}
                    icon={<Receipt size={16} className="text-white" />}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 bg-gray-50/60 rounded-t-xl">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t('expensesReport.detailedEntries')}</span>
                        <span className="text-xs text-gray-400">{t('expensesReport.entriesCount', { count: entries.length })}</span>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Receipt size={32} />
                            <p className="text-sm">{t('expensesReport.noExpenses')}</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/80 text-xs text-gray-400 uppercase tracking-wide border-b border-gray-200/60">
                                    <tr>
                                        <th className="px-3 py-2 text-left">{t('expensesReport.date')}</th>
                                        <th className="px-3 py-2 text-left">{t('expensesReport.reason')}</th>
                                        <th className="px-3 py-2 text-left">{t('expensesReport.vendor')}</th>
                                        <th className="px-3 py-2 text-left">{t('expensesReport.billNo')}</th>
                                        <th className="px-3 py-2 text-left">{t('expensesReport.mode')}</th>
                                        <th className="px-3 py-2 text-left">{t('expensesReport.status')}</th>
                                        <th className="px-3 py-2 text-right">{t('expensesReport.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.slice(0, 20).map((e) => (
                                        <tr key={e.expense_id} className="border-t border-gray-200/60 hover:bg-blue-50/20 transition-colors">
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{fmtDate(e.expense_date)}</td>
                                            <td className="px-3 py-2 text-gray-800 text-xs font-medium">{e.reason}</td>
                                            <td className="px-3 py-2 text-gray-600 text-xs">{e.vendor_name || "—"}</td>
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{e.bill_no || "—"}</td>
                                            <td className="px-3 py-2">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase border
                                                    ${e.payment_mode === "cash" ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"
                                                        : e.payment_mode === "card" ? "bg-blue-50/80 text-blue-700 border-blue-200/60"
                                                            : "bg-violet-50/80 text-violet-700 border-violet-200/60"}`}>
                                                    {getModeLabel(e.payment_mode)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                                    ${e.payment_status === "paid"
                                                        ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"
                                                        : "bg-rose-50/80 text-rose-700 border-rose-200/60"}`}>
                                                    {e.payment_status === "paid" ? <CheckCircle2 size={9} /> : <Circle size={9} />}
                                                    {getStatusLabel(e.payment_status)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2 text-gray-900 font-mono font-bold text-xs text-right">
                                                {fmtCurrency(e.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                {entries.length > 20 && (
                                    <tfoot>
                                        <tr>
                                            <td colSpan="7" className="px-3 py-2 text-xs text-gray-400 text-center border-t border-gray-200/60">
                                                {t('expensesReport.showingFirst', { count: 20, total: entries.length })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </SectionCard>

                {/* ── PDF Download Button ── */}
                <div className="flex justify-end">
                    <button
                        onClick={generatePDF}
                        disabled={loading || entries.length === 0}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all
                            ${loading || entries.length === 0
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-gradient-to-br from-gray-900 to-gray-800 hover:shadow-lg hover:shadow-gray-900/30 active:scale-95"}`}
                    >
                        <Download size={15} />
                        {t('expensesReport.downloadPDF')}
                    </button>
                </div>

            </main>
        </div>
    );
}