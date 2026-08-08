// pages/common/ExpensesReport.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Receipt, Wallet, CheckCircle2, Circle, Layers,
    Calendar, Download, FileText, Building2, CreditCard, Hash,
    AlertTriangle, BadgeCheck, X, PieChart, TrendingUp
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('expenses', 'R')) return <AccessDenied />;

    // ── Render ──
    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <PieChart size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('expensesReport.title')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('expensesReport.subtitle')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('expensesReport.anchorDate')}</span>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('expensesReport.period')}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[
                                        { v: "daily", l: t('expensesReport.periodDay') },
                                        { v: "weekly", l: t('expensesReport.periodWeek') },
                                        { v: "monthly", l: t('expensesReport.periodMonth') },
                                        { v: "yearly", l: t('expensesReport.periodYear') },
                                        { v: "custom", l: t('expensesReport.periodCustom') },
                                    ].map(({ v, l }) => (
                                        <button key={v} type="button"
                                            onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate}
                                            onChange={e => setFromDate(e.target.value)}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate}
                                            onChange={e => setToDate(e.target.value)}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap hidden sm:inline">
                                        {fromDate === toDate
                                            ? fmtDate(fromDate)
                                            : `${fmtDate(fromDate)} → ${fmtDate(toDate)}`}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Summary Cards */}
                {!loading && summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { label: t('expensesReport.totalExpenses'), value: fmtCurrency(summary.total_amount), icon: <Wallet size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                            { label: t('expensesReport.paid'), value: fmtCurrency(summary.paid_amount), icon: <CheckCircle2 size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
                            { label: t('expensesReport.unpaid'), value: fmtCurrency(summary.unpaid_amount), icon: <Circle size={14} />, color: "text-rose-600 bg-rose-50 border-rose-100" },
                            { label: t('expensesReport.entries'), value: summary.total_entries, icon: <Layers size={14} />, color: "text-violet-600 bg-violet-50 border-violet-100" },
                        ].map(({ label, value, icon, color }) => (
                            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                                <div className="shrink-0">{icon}</div>
                                <div>
                                    <p className="text-xs text-gray-400 leading-none">{label}</p>
                                    <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Breakdowns & Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Payment Mode Breakdown */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            <CreditCard size={14} /> {t('expensesReport.paymentModes')}
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(modeBreakdown).map(([mode, amount]) => (
                                    <div key={mode} className="flex items-center justify-between">
                                        <span className="text-sm capitalize text-gray-700">{getModeLabel(mode)}</span>
                                        <span className="text-sm font-semibold text-gray-900">{fmtCurrency(amount)}</span>
                                    </div>
                                ))}
                                {Object.keys(modeBreakdown).length === 0 && (
                                    <p className="text-sm text-gray-400">{t('expensesReport.noData')}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Payment Status Breakdown */}
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                            <CheckCircle2 size={14} /> {t('expensesReport.paymentStatus')}
                        </div>
                        {loading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {Object.entries(statusBreakdown).map(([status, amount]) => (
                                    <div key={status} className="flex items-center justify-between">
                                        <span className="text-sm capitalize text-gray-700">{getStatusLabel(status)}</span>
                                        <span className="text-sm font-semibold text-gray-900">{fmtCurrency(amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Entries Table (compact) */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
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
                                <thead className="bg-gray-50/80 text-xs text-gray-400 uppercase tracking-wide">
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
                                        <tr key={e.expense_id} className="border-t border-gray-50 hover:bg-blue-50/20 transition-colors">
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{fmtDate(e.expense_date)}</td>
                                            <td className="px-3 py-2 text-gray-800 text-xs font-medium">{e.reason}</td>
                                            <td className="px-3 py-2 text-gray-600 text-xs">{e.vendor_name || "—"}</td>
                                            <td className="px-3 py-2 text-gray-500 font-mono text-xs">{e.bill_no || "—"}</td>
                                            <td className="px-3 py-2">
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase
                                                    ${e.payment_mode === "cash" ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                        : e.payment_mode === "card" ? "bg-blue-50 text-blue-700 border border-blue-100"
                                                            : "bg-violet-50 text-violet-700 border border-violet-100"}`}>
                                                    {getModeLabel(e.payment_mode)}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2">
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                                                    ${e.payment_status === "paid"
                                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                                        : "bg-rose-50 text-rose-700 border border-rose-100"}`}>
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
                                            <td colSpan="7" className="px-3 py-2 text-xs text-gray-400 text-center">
                                                {t('expensesReport.showingFirst', { count: 20, total: entries.length })}
                                            </td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </div>

                {/* PDF Download Button */}
                <div className="flex justify-end">
                    <button
                        onClick={generatePDF}
                        disabled={loading || entries.length === 0}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                            ${loading || entries.length === 0
                                ? "bg-gray-300 cursor-not-allowed"
                                : "bg-black hover:bg-gray-800 active:scale-95"}`}
                    >
                        <Download size={15} />
                        {t('expensesReport.downloadPDF')}
                    </button>
                </div>

            </main>
        </div>
    );
}