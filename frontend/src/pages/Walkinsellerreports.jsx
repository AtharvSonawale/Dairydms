// WalkinSellerReports.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    BarChart3, ChevronDown, ChevronUp, Download, Search, Calendar,
    Sprout, Banknote, Smartphone, CreditCard, DollarSign, Clock,
    CheckCircle2, AlertTriangle, X, Printer, Users, TrendingUp,
    FileText, BadgeCheck, ArrowUpDown, Milk
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

const MODE_STYLES = {
    cash: "bg-emerald-50 text-emerald-700 border-emerald-100",
    upi: "bg-blue-50 text-blue-700 border-blue-100",
    credit: "bg-orange-50 text-orange-700 border-orange-100",
};

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

function PaymentBadge({ mode }) {
    const { t } = useTranslation();
    const labels = { cash: t("payments.cash"), upi: t("payments.upi"), credit: t("payments.credit") };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${MODE_STYLES[mode] || MODE_STYLES.cash}`}>
            {labels[mode] || mode}
        </span>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function WalkinSellerReports() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── Raw data ─────────────────────────────────────────────────
    const [sellers, setSellers] = useState([]);
    const [payments, setPayments] = useState([]);
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(false);

    // ── Date range + mode filter ────────────────────────────────
    const [dateRange, setDateRange] = useState({ from: today(), to: today() });
    const [rangeMode, setRangeMode] = useState("daily");
    const [filterMode, setFilterMode] = useState("all"); // all | cash | upi | credit

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
    const [undoingPayment, setUndoingPayment] = useState(null);

    // ── Clear bill ───────────────────────────────────────────────
    const [showClearBillModal, setShowClearBillModal] = useState(false);
    const [clearBillSeller, setClearBillSeller] = useState(null);
    const [clearBillAmount, setClearBillAmount] = useState("");
    const [clearingBill, setClearingBill] = useState(false);

    const [flash, setFlash] = useState(null);
    const showFlash = (type, msg) => { setFlash({ type, msg }); setTimeout(() => setFlash(null), 3500); };

    // ── Tour ─────────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                { element: '[data-tour="seller-date-filters"]', popover: { title: "Report Period", description: "Choose the period this seller report should cover, and filter by payment mode." } },
                { element: '[data-tour="seller-stats"]', popover: { title: "Seller Totals", description: "Quick totals for milk collected, amount collected, and outstanding balance across all sellers." } },
                { element: '[data-tour="seller-table"]', popover: { title: "Seller Ledger Table", description: "Click the expand icon (or row) to view the full statement with sales and payments." } },
            ],
        });
        driverObj.drive();
    };

    // ── API calls ────────────────────────────────────────────────
    const fetchSellers = async () => {
        try {
            const { data } = await api.get("/walkin-payments/buyers");
            setSellers(data.filter(b => b.buyer_type === 'seller'));
        } catch (err) {
            console.error("Failed to fetch sellers:", err);
        }
    };

    const fetchPayments = async (from, to) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/walkin-payments/payments?from=${from}&to=${to}`);
            setPayments(data.filter(p => p.buyer_type === 'seller' || p.seller_id));
        } catch (err) {
            showFlash("error", t("payments.fetch_payments_failed"));
        } finally {
            setLoading(false);
        }
    };

    const fetchSales = async (from, to) => {
        try {
            const { data } = await api.get(`/walkin-sales?from=${from}&to=${to}`);
            setSales(data.filter(s => s.seller_id && !s.buyer_id));
        } catch (err) {
            console.error("Failed to fetch sales:", err);
            setSales([]);
        }
    };

    const fetchAll = (from, to) => {
        fetchSellers();
        fetchPayments(from, to);
        fetchSales(from, to);
    };

    useEffect(() => {
        fetchAll(dateRange.from, dateRange.to);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Per-seller aggregation for the selected range ───────────
    const rangeAgg = useMemo(() => {
        const map = {};
        const ensure = (id) => {
            if (!map[id]) map[id] = { qty: 0, salesAmt: 0, cash: 0, upi: 0, credit: 0, paidTotal: 0, lastPaymentDate: null };
            return map[id];
        };
        sales.forEach(s => {
            const row = ensure(s.seller_id);
            row.qty += parseFloat(s.quantity || 0);
            row.salesAmt += parseFloat(s.total_amount || 0);
        });
        payments
            .filter(p => filterMode === "all" || p.payment_mode === filterMode)
            .forEach(p => {
                const row = ensure(p.seller_id);
                const amt = parseFloat(p.amount || 0);
                row.paidTotal += amt;
                row[p.payment_mode] = (row[p.payment_mode] || 0) + amt;
                const dk = String(p.payment_date || "").split("T")[0];
                if (!row.lastPaymentDate || dk > row.lastPaymentDate) row.lastPaymentDate = dk;
            });
        return map;
    }, [sales, payments, filterMode]);

    // ── Combined seller rows ─────────────────────────────────────
    const sellerRows = useMemo(() => {
        return sellers.map(s => {
            const agg = rangeAgg[s.seller_id] || { qty: 0, salesAmt: 0, cash: 0, upi: 0, credit: 0, paidTotal: 0, lastPaymentDate: null };
            return {
                ...s,
                range_qty: agg.qty,
                range_sales_amt: agg.salesAmt,
                range_cash: agg.cash,
                range_upi: agg.upi,
                range_credit: agg.credit,
                range_paid: agg.paidTotal,
                last_payment_date: agg.lastPaymentDate,
                outstanding_balance: parseFloat(s.outstanding_balance || 0),
                total_paid: parseFloat(s.total_paid || 0),
                total_purchases: parseFloat(s.total_purchases || 0),
            };
        });
    }, [sellers, rangeAgg]);

    // ── Filter + sort + paginate ─────────────────────────────────
    const filteredSellers = useMemo(() => {
        let rows = sellerRows.filter(s => {
            const matchSearch = !search.trim() ||
                s.name.toLowerCase().includes(search.toLowerCase()) ||
                (s.mobile || "").includes(search);
            const hasOutstanding = s.outstanding_balance > 0.01;
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
    }, [sellerRows, search, filterStatus, sortBy]);

    const totalPages = Math.max(1, Math.ceil(filteredSellers.length / pageSize));
    const paginated = filteredSellers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // ── Overall stats ─────────────────────────────────────────────
    const overall = useMemo(() => {
        const filteredPayments = payments.filter(p => filterMode === "all" || p.payment_mode === filterMode);
        return {
            totalQty: sales.reduce((a, s) => a + parseFloat(s.quantity || 0), 0),
            totalSalesAmt: sales.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0),
            totalCollected: filteredPayments.reduce((a, p) => a + parseFloat(p.amount || 0), 0),
            cashTotal: filteredPayments.filter(p => p.payment_mode === 'cash').reduce((a, p) => a + parseFloat(p.amount || 0), 0),
            upiTotal: filteredPayments.filter(p => p.payment_mode === 'upi').reduce((a, p) => a + parseFloat(p.amount || 0), 0),
            creditTotal: filteredPayments.filter(p => p.payment_mode === 'credit').reduce((a, p) => a + parseFloat(p.amount || 0), 0),
            totalOutstanding: sellers.reduce((a, s) => a + parseFloat(s.outstanding_balance || 0), 0),
            outstandingCount: sellers.filter(s => parseFloat(s.outstanding_balance || 0) > 0.01).length,
            activeSellers: sellers.length,
        };
    }, [sales, payments, sellers, filterMode]);

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
        }
        setDateRange({ from, to });
        fetchAll(from, to);
    };

    // ── Expand / seller statement ─────────────────────────────────
    const buildStatement = async (seller) => {
        setLoadingStatement(prev => ({ ...prev, [seller.seller_id]: true }));
        try {
            const [{ data: txPayments }, { data: rangeSales }] = await Promise.all([
                api.get(`/walkin-payments/buyer-payments/${seller.seller_id}?type=seller`),
                api.get(`/walkin-sales?from=${dateRange.from}&to=${dateRange.to}`),
            ]);

            const sellerSales = rangeSales.filter(s => s.seller_id === seller.seller_id && !s.buyer_id);
            const sellerPayments = txPayments.filter(p => {
                const dk = String(p.payment_date || "").split("T")[0];
                return dk >= dateRange.from && dk <= dateRange.to;
            });

            const entries = [
                ...sellerSales.map(s => ({
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
                ...sellerPayments.map(p => ({
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

            setStatementMap(prev => ({ ...prev, [seller.seller_id]: withBalance }));
        } catch (err) {
            console.error("Failed to build seller statement:", err);
            setStatementMap(prev => ({ ...prev, [seller.seller_id]: [] }));
        } finally {
            setLoadingStatement(prev => ({ ...prev, [seller.seller_id]: false }));
        }
    };

    const toggleExpand = (seller) => {
        const willOpen = !expanded[seller.seller_id];
        setExpanded(prev => ({ ...prev, [seller.seller_id]: willOpen }));
        if (willOpen) buildStatement(seller);
    };

    // ── Clear bill ────────────────────────────────────────────────
    const clearSellerBill = async () => {
        if (!clearBillSeller || !clearBillAmount) return;
        setClearingBill(true);
        try {
            await api.post("/walkin-payments/clear-bill", {
                buyer_id: null,
                seller_id: clearBillSeller.seller_id,
                amount_paid: parseFloat(clearBillAmount),
                outstanding: clearBillSeller.outstanding_balance,
            });
            showFlash("success", t("payments.bill_cleared_success", { name: clearBillSeller.name }));
            setShowClearBillModal(false);
            setClearBillSeller(null);
            setClearBillAmount("");
            await fetchAll(dateRange.from, dateRange.to);
            if (expanded[clearBillSeller.seller_id]) buildStatement(clearBillSeller);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.clear_bill_failed"));
        } finally {
            setClearingBill(false);
        }
    };

    const undoPayment = async (seller, paymentId) => {
        if (!window.confirm(t("payments.undo_payment_confirm"))) return;
        setUndoingPayment(paymentId);
        try {
            await api.delete(`/walkin-payments/payments/${paymentId}`);
            showFlash("success", t("payments.payment_undone_success"));
            await fetchAll(dateRange.from, dateRange.to);
            if (expanded[seller.seller_id]) buildStatement(seller);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.undo_payment_failed"));
        } finally {
            setUndoingPayment(null);
        }
    };

    // ── PDF: per-seller statement ─────────────────────────────────
    const printSellerStatement = (seller) => {
        const entries = statementMap[seller.seller_id] || [];
        const win = window.open("", "_blank", "width=900,height=900");
        if (!win) return;

        const periodLabel = dateRange.from === dateRange.to ? fmtDate(dateRange.from) : `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`;

        win.document.write(`<!DOCTYPE html>
<html><head><title>Seller Statement - ${seller.name}</title>
<style>
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,sans-serif; font-size:12px; margin:20px; color:#111; }
  table { width:100%; border-collapse:collapse; margin-top:12px; }
  th,td { border:1px solid #ddd; padding:6px 8px; text-align:left; }
  th { background:#111; color:#fff; font-size:11px; }
  .header { text-align:center; margin-bottom:10px; }
  .summary { display:flex; gap:12px; margin:10px 0; flex-wrap:wrap; }
  .box { background:#f3f4f6; border-radius:8px; padding:8px 12px; }
  .credit { color:#1d4ed8; font-weight:700; }
  .debit { color:#b91c1c; font-weight:700; }
  @media print { body { margin:0; padding:10px; } }
</style></head>
<body>
  <div class="header">
    <h2>Seller Statement</h2>
    <p>${seller.name}${seller.mobile ? ` · ${seller.mobile}` : ""} · Seller</p>
    <p>Period: ${periodLabel} · Generated: ${new Date().toLocaleString()}</p>
  </div>
  <div class="summary">
    <div class="box">Milk Sold: ${seller.range_qty.toFixed(2)} L</div>
    <div class="box">Sales Amount: ${fmt(seller.range_sales_amt)}</div>
    <div class="box">Paid This Period: ${fmt(seller.range_paid)}</div>
    <div class="box">Outstanding Balance: ${fmt(seller.outstanding_balance)}</div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Description</th><th>Qty (L)</th><th>Sale Amt</th><th>Paid</th><th>Running Balance</th></tr></thead>
    <tbody>
      ${entries.map(e => `
        <tr>
          <td>${fmtDate(e.date)}</td>
          <td>${e.type === 'sale' ? e.label : `Payment · ${(e.payment_mode || '').toUpperCase()}${e.remarks ? ' · ' + e.remarks : ''}`}</td>
          <td>${e.qty != null ? e.qty.toFixed(2) : "—"}</td>
          <td class="debit">${e.debit > 0 ? fmt(e.debit) : "—"}</td>
          <td class="credit">${e.credit > 0 ? fmt(e.credit) : "—"}</td>
          <td>${fmt(e.running_balance)}</td>
        </tr>`).join("")}
    </tbody>
  </table>
  <script>window.onload = () => window.print();</script>
</body></html>`);
        win.document.close();
    };

    // ── PDF: consolidated seller report ───────────────────────────
    const handleExportPDF = () => {
        const win = window.open("", "_blank", "width=1400,height=900");
        if (!win) { showFlash("error", "Popup blocked."); return; }

        const modeLabel = rangeMode === "daily" ? t("payments.daily") : rangeMode === "weekly" ? t("payments.weekly") : rangeMode === "monthly" ? t("payments.monthly") : t("payments.custom");
        const filterLabel = filterMode === "all" ? t("payments.all_modes") : filterMode === "cash" ? t("payments.cash_only") : filterMode === "upi" ? t("payments.upi_only") : t("payments.credit_only");
        const periodLabel = dateRange.from === dateRange.to ? fmtDate(dateRange.from) : `${fmtDate(dateRange.from)} – ${fmtDate(dateRange.to)}`;

        const rows = filteredSellers.map((s, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">
                <td class="td-no">${i + 1}</td>
                <td class="td-name">
                    <div class="name-full">${s.name}</div>
                    ${s.mobile ? `<div class="name-sub">${s.mobile}</div>` : ""}
                </td>
                <td class="td-num">${s.range_qty > 0 ? s.range_qty.toFixed(2) + " L" : "—"}</td>
                <td class="td-num td-bold">${s.range_sales_amt > 0 ? fmt(s.range_sales_amt) : "—"}</td>
                <td class="td-num" style="color:#15803d">${s.range_cash > 0 ? fmt(s.range_cash) : "—"}</td>
                <td class="td-num" style="color:#1d4ed8">${s.range_upi > 0 ? fmt(s.range_upi) : "—"}</td>
                <td class="td-num" style="color:#c2410c">${s.range_credit > 0 ? fmt(s.range_credit) : "—"}</td>
                <td class="td-num td-bold" style="color:#1d4ed8">${s.range_paid > 0 ? fmt(s.range_paid) : "—"}</td>
                <td class="td-num td-bold" style="color:${s.outstanding_balance > 0.01 ? '#b91c1c' : '#15803d'}">
                    ${s.outstanding_balance > 0.01 ? fmt(s.outstanding_balance) : "✓ Nil"}
                </td>
                <td class="td-center">${s.last_payment_date ? fmtShort(s.last_payment_date) : "—"}</td>
            </tr>`).join("");

        const grand = {
            qty: filteredSellers.reduce((a, s) => a + s.range_qty, 0),
            salesAmt: filteredSellers.reduce((a, s) => a + s.range_sales_amt, 0),
            cash: filteredSellers.reduce((a, s) => a + s.range_cash, 0),
            upi: filteredSellers.reduce((a, s) => a + s.range_upi, 0),
            credit: filteredSellers.reduce((a, s) => a + s.range_credit, 0),
            paid: filteredSellers.reduce((a, s) => a + s.range_paid, 0),
            outstanding: filteredSellers.reduce((a, s) => a + s.outstanding_balance, 0),
        };

        win.document.write(`<!DOCTYPE html>
<html><head><title>Seller Payments Report — ${periodLabel}</title>
<style>
  * { box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:10px; color:#111; margin:0; padding:16px; }
  .report-header { display:flex; align-items:flex-start; justify-content:space-between; margin-bottom:12px; padding-bottom:10px; border-bottom:3px double #1e3a8a; gap:12px; flex-wrap:wrap; }
  .report-title { font-size:17px; font-weight:900; color:#1e3a8a; }
  .report-sub { font-size:9px; color:#475569; margin-top:3px; }
  .report-gen { font-size:8px; color:#94a3b8; text-align:right; }
  .badges { display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; }
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
    <div class="report-title">Seller Payments Report</div>
    <div class="report-sub">${modeLabel} Report &nbsp;·&nbsp; ${filterLabel} &nbsp;·&nbsp; ${periodLabel} &nbsp;·&nbsp; ${filteredSellers.length} sellers</div>
  </div>
  <div class="report-gen">Generated: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
  <div class="badges">
    <div style="background:#f0fdf4;border:1.5px solid #bbf7d0;padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
      <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase">Cash</div>
      <div style="font-size:12px;font-weight:900;color:#15803d">${fmt(overall.cashTotal)}</div>
    </div>
    <div style="background:#eff6ff;border:1.5px solid #bfdbfe;padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
      <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase">UPI</div>
      <div style="font-size:12px;font-weight:900;color:#1d4ed8">${fmt(overall.upiTotal)}</div>
    </div>
    <div style="background:#fff7ed;border:1.5px solid #fed7aa;padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
      <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase">Credit</div>
      <div style="font-size:12px;font-weight:900;color:#c2410c">${fmt(overall.creditTotal)}</div>
    </div>
    <div style="background:#f8fafc;border:1.5px solid #cbd5e1;padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
      <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase">Outstanding</div>
      <div style="font-size:12px;font-weight:900;color:#b91c1c">${fmt(overall.totalOutstanding)}</div>
    </div>
  </div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th style="text-align:left">Seller</th><th>Qty</th><th>Sales Amt</th>
      <th>Cash</th><th>UPI</th><th>Credit</th><th>Total Paid</th><th>Balance</th><th>Last Paid</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="grand-row">
      <td colspan="2">GRAND TOTAL</td>
      <td>${grand.qty.toFixed(2)} L</td>
      <td>${fmt(grand.salesAmt)}</td>
      <td>${fmt(grand.cash)}</td>
      <td>${fmt(grand.upi)}</td>
      <td>${fmt(grand.credit)}</td>
      <td>${fmt(grand.paid)}</td>
      <td>${fmt(grand.outstanding)}</td>
      <td>—</td>
    </tr>
  </tbody>
</table>
<div class="report-footer">
  <span>Seller Payments Report · Printed ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
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
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('walkin_payments', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shadow-md">
                            <BarChart3 size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">
                                Seller Payments Report
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Sales, collections, and outstanding balances — sellers only
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={startTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition"
                        >
                            <Download size={14} /> Export PDF
                        </button>
                    </div>
                </div>

                {/* Date Range + Mode */}
                <div className="flex items-center gap-3 flex-wrap" data-tour="seller-date-filters">
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            { v: "daily", l: t("payments.day") },
                            { v: "weekly", l: t("payments.week") },
                            { v: "monthly", l: t("payments.month") },
                        ].map(({ v, l }) => (
                            <button key={v} type="button" onClick={() => handleDateRangeChange(v)}
                                className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

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

                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            { v: "all", l: t("payments.all"), icon: null },
                            { v: "cash", l: t("payments.cash"), icon: <Banknote size={12} /> },
                            { v: "upi", l: t("payments.upi"), icon: <Smartphone size={12} /> },
                            { v: "credit", l: t("payments.credit"), icon: <CreditCard size={12} /> },
                        ].map(({ v, l, icon }) => (
                            <button key={v} type="button" onClick={() => setFilterMode(v)}
                                className={`flex items-center gap-1.5 px-3 py-2 transition border-r last:border-r-0 border-gray-200
                                    ${filterMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {icon}{l}
                            </button>
                        ))}
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="seller-stats">
                    <StatCard label="Milk Collected" value={`${overall.totalQty.toFixed(2)} L`} icon={<Milk size={14} />} color="text-violet-600 bg-violet-50 border-violet-100" />
                    <StatCard label="Sales Amount" value={fmt(overall.totalSalesAmt)} icon={<TrendingUp size={14} />} color="text-blue-600 bg-blue-50 border-blue-100" />
                    <StatCard label="Amount Collected" value={fmt(overall.totalCollected)} icon={<DollarSign size={14} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                    <StatCard label="Total Outstanding" value={fmt(overall.totalOutstanding)}
                        sub={`${overall.outstandingCount} of ${overall.activeSellers} sellers`}
                        icon={<Clock size={14} />} color="text-rose-600 bg-rose-50 border-rose-100" />
                </div>

                {/* Search + Filter + Sort */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder="Search sellers by name or mobile"
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>

                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            ["all", t("payments.all")],
                            ["outstanding", t("payments.outstanding")],
                            ["cleared", t("payments.cleared")],
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => { setFilterStatus(v); setCurrentPage(1); }}
                                className={`px-3 py-2 transition border-r last:border-r-0 border-gray-200
                                    ${filterStatus === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                        <ArrowUpDown size={12} className="text-gray-400" />
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition">
                            <option value="outstanding">Sort: Outstanding</option>
                            <option value="sales">Sort: Sales Amount</option>
                            <option value="paid">Sort: Amount Paid</option>
                            <option value="name">Sort: Name</option>
                        </select>
                    </div>

                    <span className="ml-auto text-xs text-gray-400">
                        {filteredSellers.length} {filteredSellers.length !== 1 ? "sellers" : "seller"}
                    </span>
                </div>

                {/* Seller Table */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" data-tour="seller-table">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : paginated.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Users size={32} />
                            <p className="text-sm">No sellers found for this period</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                        <th className="px-4 py-3 w-10">#</th>
                                        <th className="px-4 py-3 min-w-[130px]">Seller</th>
                                        <th className="px-4 py-3 text-right">Qty (L)</th>
                                        <th className="px-4 py-3 text-right">Sales Amt</th>
                                        <th className="px-4 py-3 text-right">Total Paid</th>
                                        <th className="px-4 py-3 text-right">Balance</th>
                                        <th className="px-4 py-3 text-center">Last Paid</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginated.map((seller, idx) => {
                                        const hasOutstanding = seller.outstanding_balance > 0.01;
                                        const isOpen = expanded[seller.seller_id];
                                        const entries = statementMap[seller.seller_id] || [];

                                        return (
                                            <React.Fragment key={seller.seller_id}>
                                                {/* Main row */}
                                                <tr
                                                    className={`border-b border-gray-100 hover:bg-gray-50/50 transition cursor-pointer ${hasOutstanding ? 'bg-rose-50/30' : ''}`}
                                                    onClick={() => toggleExpand(seller)}
                                                >
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                        {idx + 1 + (currentPage - 1) * pageSize}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                                                ${hasOutstanding ? "bg-rose-100 text-rose-700" : "bg-violet-100 text-violet-700"}`}>
                                                                {seller.name?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="font-semibold text-gray-800 truncate">{seller.name}</p>
                                                                {seller.mobile && <p className="text-[10px] text-gray-400">{seller.mobile}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono text-sm">
                                                        {seller.range_qty > 0 ? seller.range_qty.toFixed(2) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-gray-700">
                                                        {seller.range_sales_amt > 0 ? fmt(seller.range_sales_amt) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                                        {seller.range_paid > 0 ? fmt(seller.range_paid) : "—"}
                                                    </td>
                                                    <td className={`px-4 py-3 text-right font-bold ${hasOutstanding ? "text-rose-600" : "text-emerald-600"}`}>
                                                        {hasOutstanding ? fmt(seller.outstanding_balance) : "✓ Nil"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-gray-400">
                                                        {seller.last_payment_date ? fmtShort(seller.last_payment_date) : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            {hasOutstanding && can('walkin_payments', 'W') && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setClearBillSeller(seller);
                                                                        setClearBillAmount(String(seller.outstanding_balance.toFixed(2)));
                                                                        setShowClearBillModal(true);
                                                                    }}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-[10px] font-semibold transition shadow-sm"
                                                                >
                                                                    <Banknote size={10} /> {t("payments.clear_bill")}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (!entries.length) buildStatement(seller);
                                                                    printSellerStatement(seller);
                                                                }}
                                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-semibold transition shadow-sm"
                                                            >
                                                                <Printer size={10} /> PDF
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleExpand(seller);
                                                                }}
                                                                className="flex items-center justify-center w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-500 transition"
                                                            >
                                                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Expanded statement row */}
                                                {isOpen && (
                                                    <tr>
                                                        <td colSpan="8" className="px-4 py-4 bg-gray-50/80 border-t border-gray-100">
                                                            <div className="flex flex-col gap-3">
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                                                        Statement · {fmtShort(dateRange.from)} → {fmtShort(dateRange.to)}
                                                                    </p>
                                                                    <div className="flex items-center gap-3 text-[10px]">
                                                                        <span className="text-gray-400">Mode: </span>
                                                                        {seller.range_cash > 0 && <PaymentBadge mode="cash" />}
                                                                        {seller.range_upi > 0 && <PaymentBadge mode="upi" />}
                                                                        {seller.range_credit > 0 && <PaymentBadge mode="credit" />}
                                                                    </div>
                                                                </div>

                                                                {loadingStatement[seller.seller_id] ? (
                                                                    <div className="flex justify-center py-6">
                                                                        <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                                                                    </div>
                                                                ) : entries.length === 0 ? (
                                                                    <p className="text-xs text-gray-400 py-2">No sales or payments recorded in this period.</p>
                                                                ) : (
                                                                    <div className="rounded-xl border border-gray-200 overflow-hidden overflow-x-auto">
                                                                        <div className="min-w-[640px]">
                                                                            <div className="grid bg-gray-100 border-b border-gray-200"
                                                                                style={{ gridTemplateColumns: "90px 1fr 80px 100px 100px 110px 80px" }}>
                                                                                {["Date", "Description", "Qty (L)", "Sale Amt", "Paid", "Balance", ""].map(h => (
                                                                                    <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{h}</div>
                                                                                ))}
                                                                            </div>
                                                                            {entries.map((e, i) => (
                                                                                <div key={i} className="grid border-b border-gray-50 last:border-0 hover:bg-white transition"
                                                                                    style={{ gridTemplateColumns: "90px 1fr 80px 100px 100px 110px 80px" }}>
                                                                                    <div className="px-3 py-2 text-xs text-gray-600">{fmtShort(e.date)}</div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-700">
                                                                                        {e.type === 'sale' ? e.label : (
                                                                                            <span className="flex items-center gap-1.5">
                                                                                                <PaymentBadge mode={e.payment_mode} />
                                                                                                {e.remarks && <span className="text-gray-400 truncate">{e.remarks}</span>}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="px-3 py-2 text-xs text-gray-500 font-mono">{e.qty != null ? e.qty.toFixed(2) : "—"}</div>
                                                                                    <div className="px-3 py-2 text-xs font-semibold text-rose-600">{e.debit > 0 ? fmt(e.debit) : "—"}</div>
                                                                                    <div className="px-3 py-2 text-xs font-semibold text-emerald-600">{e.credit > 0 ? fmt(e.credit) : "—"}</div>
                                                                                    <div className="px-3 py-2 text-xs font-bold text-gray-800">{fmt(e.running_balance)}</div>
                                                                                    <div className="px-3 py-2 flex items-center">
                                                                                        {e.type === 'payment' && (
                                                                                            <button
                                                                                                onClick={() => undoPayment(seller, e.payment_id)}
                                                                                                disabled={undoingPayment === e.payment_id}
                                                                                                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
                                                                                                    bg-rose-50 text-rose-600 border border-rose-100
                                                                                                    hover:bg-rose-100 disabled:opacity-40 transition">
                                                                                                {undoingPayment === e.payment_id
                                                                                                    ? <span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                                                                                                    : <X size={10} />}
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

                    {/* Pagination */}
                    {filteredSellers.length > 0 && (
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

            {/* Clear Bill Modal */}
            {showClearBillModal && clearBillSeller && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Banknote size={15} className="text-rose-500" /> {t("payments.clear_bill")}
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">{clearBillSeller.name}</p>
                            </div>
                            <button onClick={() => setShowClearBillModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-600">{t("payments.outstanding_balance")}</p>
                                <p className="text-2xl font-bold text-rose-600">₹{clearBillSeller.outstanding_balance.toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("payments.amount_paid")}</label>
                                <input type="number" value={clearBillAmount} onChange={e => setClearBillAmount(e.target.value)}
                                    step="0.01" min="0" max={clearBillSeller.outstanding_balance}
                                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition" />
                            </div>
                            {clearBillAmount && parseFloat(clearBillAmount) < clearBillSeller.outstanding_balance && (
                                <p className="text-xs text-amber-600">
                                    ₹{(clearBillSeller.outstanding_balance - parseFloat(clearBillAmount)).toFixed(2)} {t("payments.will_remain_as_balance")}
                                </p>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowClearBillModal(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    {t("payments.cancel")}
                                </button>
                                <button onClick={clearSellerBill} disabled={clearingBill || !clearBillAmount || parseFloat(clearBillAmount) <= 0}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition disabled:opacity-40 flex items-center justify-center gap-2">
                                    {clearingBill && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {clearingBill ? t("payments.processing") : t("payments.clear_bill")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}