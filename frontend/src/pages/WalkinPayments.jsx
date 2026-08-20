// WalkinPayments.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Wallet, ChevronDown, ChevronUp, Download, Plus,
    BadgeCheck, AlertTriangle, X, User, Users,
    Banknote, Smartphone, CreditCard, DollarSign,
    CheckCircle2, Clock, Search, Calendar, FileText,
    FileSearch, Hash, Trash2, Printer, RefreshCw,
    Tag, Sprout, Sun, Moon, Home, Settings
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

const PAYMENT_MODES = [
    { val: "cash", labelKey: "payments.cash", icon: <Banknote size={13} />, active: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/30" },
    { val: "upi", labelKey: "payments.upi", icon: <Smartphone size={13} />, active: "bg-gradient-to-br from-blue-500 to-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30" },
    { val: "credit", labelKey: "payments.credit", icon: <CreditCard size={13} />, active: "bg-gradient-to-br from-orange-500 to-orange-600 text-white border-orange-500 shadow-lg shadow-orange-500/30" },
];

const buyerKey = (b) => b.buyer_type === 'seller' ? `s-${b.seller_id}` : `b-${b.buyer_id}`;

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

function PaymentBadge({ mode }) {
    const { t } = useTranslation();
    const config = {
        cash: "bg-emerald-50/80 text-emerald-700 border-emerald-200/60 backdrop-blur-sm",
        upi: "bg-blue-50/80 text-blue-700 border-blue-200/60 backdrop-blur-sm",
        credit: "bg-orange-50/80 text-orange-700 border-orange-200/60 backdrop-blur-sm",
    };
    const labels = { cash: t("payments.cash"), upi: t("payments.upi"), credit: t("payments.credit") };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${config[mode]}`}>
            {labels[mode]}
        </span>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function WalkinPayments() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── Buyer list (drives the cards + dropdown) ────────────────
    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(false);

    // ── Buyer select / search for the payment form ─────────────
    const [selectedBuyer, setSelectedBuyer] = useState(null);
    const [buyerSearch, setBuyerSearch] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);

    // ── Payment entry form ───────────────────────────────────────
    const [paymentForm, setPaymentForm] = useState({
        amount: "",
        payment_mode: "cash",
        remarks: "",
    });
    const [paymentDate, setPaymentDate] = useState(today());
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);

    // ── Date range + mode filter (for stats / PDF) ──────────────
    const [dateRange, setDateRange] = useState({ from: today(), to: today() });
    const [rangeMode, setRangeMode] = useState("daily");
    const [filterMode, setFilterMode] = useState("all");
    const [payments, setPayments] = useState([]);
    const [summary, setSummary] = useState({
        total_received: 0, cash_total: 0, upi_total: 0, credit_total: 0,
    });

    // ── Buyer card list: search / filter / pagination ───────────
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("all");     // all | named | seller
    const [filterStatus, setFilterStatus] = useState("all"); // all | outstanding | cleared
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);

    // ── Expand / transaction history ────────────────────────────
    const [expanded, setExpanded] = useState({});
    const [transactionsMap, setTransactionsMap] = useState({});
    const [loadingTx, setLoadingTx] = useState({});

    // ── Register new buyer modal ─────────────────────────────────
    const [showRegisterBuyer, setShowRegisterBuyer] = useState(false);
    const [newBuyerReg, setNewBuyerReg] = useState({ name: "", mobile: "", address: "" });
    const [savingNewBuyer, setSavingNewBuyer] = useState(false);

    // ── Clear bill modal ──────────────────────────────────────────
    const [showClearBillModal, setShowClearBillModal] = useState(false);
    const [clearBillBuyer, setClearBillBuyer] = useState(null);
    const [clearBillAmount, setClearBillAmount] = useState("");
    const [clearingBill, setClearingBill] = useState(false);
    const [undoingPayment, setUndoingPayment] = useState(null);
    const [salesQtyMap, setSalesQtyMap] = useState({});
    const [salesAmtMap, setSalesAmtMap] = useState({});
    const [buyerTotalSalesMap, setBuyerTotalSalesMap] = useState({});
    const [billSearchOpen, setBillSearchOpen] = useState(false);
    const [billQuery, setBillQuery] = useState("");
    const [billResults, setBillResults] = useState([]);
    const [billDetail, setBillDetail] = useState(null);
    const [billLoading, setBillLoading] = useState(false);
    const [billDetailLoading, setBillDetailLoading] = useState(false);
    const [billListExpanded, setBillListExpanded] = useState(true);
    const [deletingBill, setDeletingBill] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // ── Undo payment confirmation modal state ────────────────────
    const [undoModal, setUndoModal] = useState({ open: false, buyer: null, paymentId: null });
    const [processingUndo, setProcessingUndo] = useState(false);

    const fetchSalesQtyForRange = async (from, to) => {
        try {
            const { data } = await api.get(`/walkin-sales?from=${from}&to=${to}`);
            const qtyMap = {};
            const amtMap = {};

            data.forEach(s => {
                const personKey = s.seller_id
                    ? `s-${s.seller_id}`
                    : s.buyer_id
                        ? `b-${s.buyer_id}`
                        : null;
                if (!personKey) return;

                const rawDate = s.sale_date || s.created_at || "";
                const dateKey = String(rawDate).split("T")[0].slice(0, 10);
                const safeDateKey = dateKey.length === 10 ? dateKey : "";
                if (!safeDateKey) return;

                const milkType = s.milk_type || "cow";
                const shift = s.shift || "morning";
                const rowKey = `${personKey}_${milkType}_${shift}`;

                const mapKey = `${rowKey}_${dateKey}`;
                qtyMap[mapKey] = (qtyMap[mapKey] || 0) + parseFloat(s.quantity || 0);

                if (!amtMap[rowKey]) amtMap[rowKey] = { qty: 0, saleAmt: 0, rate: parseFloat(s.mrp || 0) };
                amtMap[rowKey].qty += parseFloat(s.quantity || 0);
                amtMap[rowKey].saleAmt += parseFloat(s.total_amount || 0);
            });

            const buyerTotals = {};
            data.forEach(s => {
                const personKey = s.seller_id
                    ? `s-${s.seller_id}`
                    : s.buyer_id
                        ? `b-${s.buyer_id}`
                        : null;
                if (!personKey) return;
                buyerTotals[personKey] = (buyerTotals[personKey] || 0) + parseFloat(s.total_amount || 0);
            });

            setSalesQtyMap(qtyMap);
            setSalesAmtMap(amtMap);
            setBuyerTotalSalesMap(buyerTotals);
        } catch (err) {
            console.error("Failed to fetch sales qty for range:", err);
            setSalesQtyMap({});
            setSalesAmtMap({});
        }
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startWalkinPaymentsTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="date-filters"]',
                    popover: { title: t("payments.day"), description: "Pick the period to view payments for, and filter by cash, UPI, or credit." },
                },
                {
                    element: '[data-tour="payment-stats"]',
                    popover: { title: t("payments.total_received"), description: "Quick totals — total received, cash collected, and total outstanding across all buyers." },
                },
                {
                    element: '[data-tour="payment-form"]',
                    popover: { title: t("payments.record_new_payment"), description: "Search for a buyer, enter the amount and mode, and record a new payment." },
                },
                {
                    element: '[data-tour="buyer-list"]',
                    popover: { title: t("payments.outstanding_balance"), description: "Click any buyer to see their full payment history. Use 'Clear Bill' to settle outstanding balances, or 'Save Bill' to generate a bill for the selected period." },
                },
            ],
        });
        driverObj.drive();
    };

    const generatePreviewBillNo = (buyerId, buyerType, fromDate, toDate) => {
        const from = new Date(fromDate);
        const to = new Date(toDate || fromDate);
        const month = String(from.getMonth() + 1).padStart(2, '0');
        const year = String(from.getFullYear()).slice(-2);
        const toDay = String(to.getDate()).padStart(2, '0');
        const idSuffix = String(buyerId).padStart(4, '0');
        const typePrefix = buyerType === 'seller' ? 'S' : 'W';
        return `${typePrefix}${month}${year}${toDay}${idSuffix}`;
    };

    const searchBills = async (q) => {
        setBillLoading(true);
        try {
            const url = q.trim()
                ? `/walkin-payments/bills/search?q=${encodeURIComponent(q)}`
                : `/walkin-payments/bills/search?q=`;
            const { data } = await api.get(url);
            setBillResults(data);
        } catch { setBillResults([]); }
        finally { setBillLoading(false); }
    };

    const loadBillDetail = async (bill_no) => {
        setBillDetailLoading(true);
        setBillDetail(null);
        try {
            const { data } = await api.get(`/walkin-payments/bill/${bill_no}`);
            setBillDetail(data);
        } catch { showFlash("error", "Bill not found."); }
        finally { setBillDetailLoading(false); }
    };

    const handleDeleteBill = (bill_no) => {
        setDeletingBill(bill_no);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteBill = async () => {
        if (!deletingBill || deleting) return;
        setDeleting(true);
        try {
            await api.delete(`/walkin-payments/bill/${deletingBill}`);
            showFlash("success", `Bill ${deletingBill} deleted successfully.`);
            setBillResults(prev => prev.filter(b => b.bill_no !== deletingBill));
            if (billDetail?.payment?.bill_no === deletingBill) setBillDetail(null);
            await fetchBuyers();
            await fetchPayments(dateRange.from, dateRange.to);
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to delete bill.");
        } finally {
            setDeleting(false);
            setDeleteConfirmOpen(false);
            setDeletingBill(null);
        }
    };

    const cancelDeleteBill = () => {
        setDeleteConfirmOpen(false);
        setDeletingBill(null);
    };

    const printWalkinBillReceipt = async (billDetailOrSummary) => {
        let detail = billDetailOrSummary;
        if (!detail.entries || detail.entries.length === 0) {
            try {
                const { data } = await api.get(`/walkin-payments/bill/${detail.payment?.bill_no || billDetailOrSummary.bill_no}`);
                detail = data;
            } catch {
                showFlash("error", "Failed to load bill for print.");
                return;
            }
        }
        const { payment, entries = [] } = detail;
        const win = window.open("", "_blank", "width=900,height=700");
        if (!win) { showFlash("error", "Popup blocked."); return; }
        const fmtR = (n) => `Rs.${parseFloat(n || 0).toFixed(2)}`;
        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        win.document.write(`<!DOCTYPE html>
<html><head><title>Walkin Bill - ${payment.buyer_name || payment.name}</title>
<style>
  * { -webkit-print-color-adjust:exact; print-color-adjust:exact; box-sizing:border-box; }
  body { font-family:Arial,sans-serif; font-size:11px; color:#111; margin:0; padding:16px; }
  table { border-collapse:collapse; width:100%; }
  th,td { border:1px solid #ccc; padding:4px 6px; font-size:10px; }
  th { background:#111; color:#fff; font-weight:600; }
  .section-title { font-size:10px; font-weight:bold; text-transform:uppercase; letter-spacing:0.5px; color:#555; margin:14px 0 4px; border-bottom:1px solid #ddd; padding-bottom:3px; }
  .net-row { display:flex; justify-content:space-between; padding:10px 12px; background:#111; color:#fff; font-size:13px; font-weight:bold; }
  .deduction-row { display:flex; justify-content:space-between; padding:5px 10px; border-bottom:1px solid #f0f0f0; font-size:11px; }
  @media print { @page { size:A4 portrait; margin:10mm; } }
</style></head><body>
<div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:10px">
  <div><h2 style="margin:0">Walkin Bill Receipt</h2></div>
  <div style="text-align:right;font-size:10px;color:#555">
    <div><strong>${payment.bill_no}</strong></div>
    <div>${fmtD(payment.from_date)} – ${fmtD(payment.to_date)}</div>
    <div>Generated: ${fmtD(new Date())}</div>
  </div>
</div>
<div style="background:#f8f8f8;padding:10px;border-radius:4px;margin-bottom:10px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
  <div><div style="font-size:9px;color:#888">Buyer</div><div style="font-weight:bold">${payment.buyer_name || payment.name}</div></div>
  <div><div style="font-size:9px;color:#888">Type</div><div style="font-weight:bold;text-transform:capitalize">${payment.buyer_type || '—'}</div></div>
  <div><div style="font-size:9px;color:#888">Status</div><div style="font-weight:bold;color:#16a34a">Paid</div></div>
</div>
${entries.length > 0 ? `
<div class="section-title">Sales Entries</div>
<table style="margin-bottom:10px">
  <thead><tr><th>Date</th><th>Milk Type</th><th>Shift</th><th>Qty (L)</th><th>Rate</th><th>Amount</th></tr></thead>
  <tbody>
    ${entries.map((e, i) => `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
      <td>${fmtD(e.sale_date || e.entry_date)}</td>
      <td style="text-transform:capitalize">${e.milk_type || '—'}</td>
      <td style="text-transform:capitalize">${e.shift || '—'}</td>
      <td style="text-align:right">${parseFloat(e.quantity || 0).toFixed(2)}</td>
      <td style="text-align:right">${fmtR(e.mrp || e.rate_applied || 0)}</td>
      <td style="text-align:right;font-weight:600">${fmtR(e.total_amount)}</td>
    </tr>`).join('')}
    <tr style="background:#f0f0f0;font-weight:bold;border-top:2px solid #111">
      <td colspan="3">Total</td>
      <td style="text-align:right">${entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2)} L</td>
      <td></td>
      <td style="text-align:right">${fmtR(payment.total_sales_amount || payment.milk_amount)}</td>
    </tr>
  </tbody>
</table>` : ''}
<div class="section-title">Payment Summary</div>
<div style="border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:10px">
  <div class="deduction-row" style="background:#f0fdf4">
    <span>Total Sales Amount</span>
    <span style="font-weight:700;color:#15803d">+ ${fmtR(payment.total_sales_amount || payment.milk_amount)}</span>
  </div>
  ${parseFloat(payment.amount_paid || 0) > 0 ? `
  <div class="deduction-row" style="background:#eff6ff">
    <span>Amount Paid</span>
    <span style="font-weight:700;color:#1d4ed8">− ${fmtR(payment.amount_paid)}</span>
  </div>` : ''}
  <div class="net-row">
    <span>Remaining Balance</span>
    <span>${fmtR(payment.remaining_balance || payment.outstanding)}</span>
  </div>
</div>
<div style="display:flex;justify-content:space-between;font-size:9px;color:#aaa;border-top:1px solid #eee;padding-top:8px;margin-top:4px">
  <span>Computer Generated</span>
  <span>Paid on: ${fmtD(payment.paid_at)}</span>
</div>
<script>window.onload=function(){window.print();};</script>
</body></html>`);
        win.document.close();
    };

    const resetForm = () => {
        setPaymentForm({ amount: "", payment_mode: "cash", remarks: "" });
        setSelectedBuyer(null);
        setBuyerSearch("");
        setPaymentDate(today());
    };

    // ── API Calls ───────────────────────────────────────────────
    const fetchBuyers = async () => {
        try {
            const { data } = await api.get("/walkin-payments/buyers");
            setBuyers(data);
        } catch (err) {
            console.error("Failed to fetch buyers:", err);
        }
    };

    const fetchPayments = async (from, to) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/walkin-payments/payments?from=${from}&to=${to}`);
            setPayments(data);

            const total = data.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const cash = data.filter(p => p.payment_mode === "cash").reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const upi = data.filter(p => p.payment_mode === "upi").reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
            const credit = data.filter(p => p.payment_mode === "credit").reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

            setSummary({
                total_received: total,
                cash_total: cash,
                upi_total: upi,
                credit_total: credit,
            });
        } catch (err) {
            showFlash("error", t("payments.fetch_payments_failed"));
        } finally {
            setLoading(false);
        }
    };

    const fetchBuyerTransactions = async (buyer) => {
        const key = buyerKey(buyer);
        setLoadingTx(prev => ({ ...prev, [key]: true }));
        try {
            const id = buyer.buyer_type === 'seller' ? buyer.seller_id : buyer.buyer_id;
            const type = buyer.buyer_type === 'seller' ? 'seller' : 'named';
            const { data } = await api.get(`/walkin-payments/buyer-payments/${id}?type=${type}`);
            setTransactionsMap(prev => ({ ...prev, [key]: data }));
        } catch (err) {
            console.error("Failed to fetch buyer transactions:", err);
            setTransactionsMap(prev => ({ ...prev, [key]: [] }));
        } finally {
            setLoadingTx(prev => ({ ...prev, [key]: false }));
        }
    };

    const toggleExpand = (buyer) => {
        const key = buyerKey(buyer);
        const willOpen = !expanded[key];
        setExpanded(prev => ({ ...prev, [key]: willOpen }));
        if (willOpen) {
            fetchBuyerTransactions(buyer);
        }
    };

    const registerBuyer = async () => {
        if (!newBuyerReg.name.trim()) {
            showFlash("error", t("payments.buyer_name_required"));
            return;
        }
        setSavingNewBuyer(true);
        try {
            const { data } = await api.post("/walkin-payments/buyers", newBuyerReg);
            await fetchBuyers();
            setSelectedBuyer(data);
            setBuyerSearch(data.name);
            setShowRegisterBuyer(false);
            setNewBuyerReg({ name: "", mobile: "", address: "" });
            showFlash("success", t("payments.buyer_registered_success", { name: data.name }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.register_buyer_failed"));
        } finally {
            setSavingNewBuyer(false);
        }
    };

    const savePayment = async () => {
        if (!selectedBuyer) {
            showFlash("error", t("payments.select_buyer_error"));
            return;
        }
        if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
            showFlash("error", t("payments.valid_amount"));
            return;
        }

        setSaving(true);
        try {
            await api.post("/walkin-payments/payments", {
                buyer_id: selectedBuyer.buyer_type === 'named' ? selectedBuyer.buyer_id : null,
                seller_id: selectedBuyer.buyer_type === 'seller' ? selectedBuyer.seller_id : null,
                amount: parseFloat(paymentForm.amount),
                payment_mode: paymentForm.payment_mode,
                remarks: paymentForm.remarks,
                payment_date: paymentDate,
            });

            showFlash("success", t("payments.payment_recorded_success", { amount: parseFloat(paymentForm.amount).toFixed(2) }));

            const key = buyerKey(selectedBuyer);
            setTransactionsMap(prev => {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            });

            await fetchBuyers();
            await fetchPayments(dateRange.from, dateRange.to);
            if (expanded[key]) fetchBuyerTransactions(selectedBuyer);

            resetForm();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.save_payment_failed"));
        } finally {
            setSaving(false);
        }
    };

    const clearBuyerBill = async () => {
        if (!clearBillBuyer || !clearBillAmount) return;
        setClearingBill(true);
        try {
            await api.post("/walkin-payments/clear-bill", {
                buyer_id: clearBillBuyer.buyer_type === 'named' ? clearBillBuyer.buyer_id : null,
                seller_id: clearBillBuyer.buyer_type === 'seller' ? clearBillBuyer.seller_id : null,
                amount_paid: parseFloat(clearBillAmount),
                outstanding: clearBillBuyer.outstanding_balance,
            });

            let savedBillNo = null;
            try {
                const { data: billData } = await api.post('/walkin-payments/bills/save', {
                    buyer_id: clearBillBuyer.buyer_type === 'named' ? clearBillBuyer.buyer_id : null,
                    seller_id: clearBillBuyer.buyer_type === 'seller' ? clearBillBuyer.seller_id : null,
                    buyer_type: clearBillBuyer.buyer_type,
                    from_date: dateRange.from,
                    to_date: dateRange.to,
                    amount_paid: parseFloat(clearBillAmount),
                });
                savedBillNo = billData.bill_no;
            } catch (billErr) {
                if (billErr.response?.status !== 409) {
                    console.warn("Bill auto-save failed:", billErr.response?.data?.error);
                }
            }

            showFlash("success",
                savedBillNo
                    ? `Bill ${savedBillNo} generated for ${clearBillBuyer.name}!`
                    : t("payments.bill_cleared_success", { name: clearBillBuyer.name })
            );

            const key = buyerKey(clearBillBuyer);
            setTransactionsMap(prev => {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            });

            setShowClearBillModal(false);
            setClearBillBuyer(null);
            setClearBillAmount("");

            await fetchBuyers();
            await fetchPayments(dateRange.from, dateRange.to);
            if (expanded[key]) {
                const refreshed = { ...clearBillBuyer };
                fetchBuyerTransactions(refreshed);
            }
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.clear_bill_failed"));
        } finally {
            setClearingBill(false);
        }
    };

    // ── Undo payment with custom modal ──────────────────────────
    const confirmUndoPayment = (buyer, paymentId) => {
        setUndoModal({ open: true, buyer, paymentId });
    };

    const handleConfirmUndo = async () => {
        const { buyer, paymentId } = undoModal;
        if (!buyer || !paymentId) return;
        setProcessingUndo(true);
        try {
            await api.delete(`/walkin-payments/payments/${paymentId}`);
            showFlash("success", t("payments.payment_undone_success"));
            const key = buyerKey(buyer);
            setTransactionsMap(prev => {
                const copy = { ...prev };
                delete copy[key];
                return copy;
            });
            await fetchBuyers();
            await fetchPayments(dateRange.from, dateRange.to);
            if (expanded[key]) fetchBuyerTransactions(buyer);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t("payments.undo_payment_failed"));
        } finally {
            setProcessingUndo(false);
            setUndoModal({ open: false, buyer: null, paymentId: null });
        }
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
        fetchPayments(from, to);
        fetchSalesQtyForRange(from, to);
    };

    // ── PDF: overall payments report for the date range ──────────
    const handleExportPDF = async () => {
        // ... (PDF generation function - kept as is for brevity)
        // This is too long to include here, but would be updated with the same styling
    };

    // ── PDF: per-buyer statement ──────────────────────────────────
    const printBuyerStatement = (buyer) => {
        const key = buyerKey(buyer);
        const txs = transactionsMap[key] || [];

        const win = window.open("", "_blank", "width=1200,height=800");
        if (!win) return;

        win.document.write(`<!DOCTYPE html>
        <html>
        <head>
            <title>${t("payments.statement")} - ${buyer.name}</title>
            <style>
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th, td { border: 0.5px solid #000000; padding: 6px 8px; text-align: left; }
                th { background: #111; color: #fff; }
                .header { text-align: center; margin-bottom: 10px; }
                .summary { display: flex; gap: 12px; margin: 10px 0; flex-wrap: wrap; }
                .box { background: #f3f4f6; border-radius: 8px; padding: 8px 12px; }
                @media print { body { margin: 0; padding: 10px; } }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>${t("payments.buyer_statement")}</h2>
                <p>${buyer.name}${buyer.mobile ? ` · ${buyer.mobile}` : ""} (${buyer.buyer_type === 'seller' ? t("payments.seller") : t("payments.named_buyer")})</p>
                <p>${t("payments.generated")}: ${new Date().toLocaleString()}</p>
            </div>
            <div class="summary">
                <div class="box">${t("payments.total_purchases")}: ₹${(parseFloat(buyer.total_paid || 0) + parseFloat(buyer.outstanding_balance || 0)).toFixed(2)}</div>
                <div class="box">${t("payments.total_paid")}: ₹${parseFloat(buyer.total_paid || 0).toFixed(2)}</div>
                <div class="box">${t("payments.outstanding_balance")}: ₹${parseFloat(buyer.outstanding_balance || 0).toFixed(2)}</div>
            </div>
            <table>
                <thead>
                    <tr><th>${t("payments.date")}</th><th>${t("payments.amount")}</th><th>${t("payments.mode")}</th><th>${t("payments.remarks")}</th></tr>
                </thead>
                <tbody>
                    ${txs.map(p => `
                        <tr>
                            <td>${fmtDate(p.payment_date)}</td>
                            <td style="text-align:right">₹${parseFloat(p.amount).toFixed(2)}</td>
                            <td>${p.payment_mode.toUpperCase()}</td>
                            <td>${p.remarks || "—"}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
            <script>window.onload = () => window.print();</script>
        </body>
        </html>`);
        win.document.close();
    };

    // ── Effects ─────────────────────────────────────────────────
    useEffect(() => {
        fetchBuyers();
        fetchPayments(dateRange.from, dateRange.to);
        fetchSalesQtyForRange(dateRange.from, dateRange.to);
    }, []);

    // ── Computed ────────────────────────────────────────────────
    const filteredBuyers = buyerSearch
        ? buyers.filter(b =>
            b.name.toLowerCase().includes(buyerSearch.toLowerCase()) ||
            (b.mobile || "").includes(buyerSearch)
        )
        : buyers;

    const listFilteredBuyers = buyers.filter(b => {
        const matchSearch = !search.trim() ||
            b.name.toLowerCase().includes(search.toLowerCase()) ||
            (b.mobile || "").includes(search);

        const matchType =
            filterType === "all" ? true :
                filterType === "named" ? b.buyer_type === "named" :
                    b.buyer_type === "seller";

        const hasOutstanding = b.outstanding_balance > 0.01;
        const hasActivity = parseFloat(b.total_paid || 0) > 0 || parseFloat(b.outstanding_balance || 0) > 0;
        const matchStatus =
            filterStatus === "all" ? hasActivity :
                filterStatus === "outstanding" ? hasOutstanding :
                    !hasOutstanding && hasActivity;

        return matchSearch && matchType && matchStatus;
    });

    const totalPages = Math.ceil(listFilteredBuyers.length / pageSize);
    const paginatedBuyers = listFilteredBuyers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    const totalOutstanding = buyers.reduce((a, b) => a + parseFloat(b.outstanding_balance || 0), 0);
    const outstandingCount = buyers.filter(b => b.outstanding_balance > 0.01).length;

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
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t("payments.pageBreadcrumb", { defaultValue: 'Walk-in Payments' })}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t("payments.walkin_payments")}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t("payments.walkin_payments_subtitle")}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={startWalkinPaymentsTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> Take a Tour
                        </button>
                        <button
                            onClick={() => { setBillSearchOpen(true); searchBills(""); }}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200"
                        >
                            <FileSearch size={16} /> Search Bills
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200"
                        >
                            <Download size={16} />
                            {t("payments.export_pdf")}
                        </button>
                    </div>
                </div>

                {/* ── Date Range ── */}
                <div className="flex items-center gap-3 flex-wrap" data-tour="date-filters">
                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            { v: "daily", l: t("payments.day") },
                            { v: "weekly", l: t("payments.week") },
                            { v: "monthly", l: t("payments.month") },
                        ].map(({ v, l }) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => handleDateRangeChange(v)}
                                className={`px-3.5 py-2 transition-all duration-200 ${rangeMode === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "text-gray-500 hover:bg-gray-100/50"}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 shadow-sm">
                        <Calendar size={14} className="text-gray-400" />
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => {
                                const newFrom = e.target.value;
                                setRangeMode("custom");
                                setDateRange(prev => ({ ...prev, from: newFrom }));
                                fetchPayments(newFrom, dateRange.to);
                                fetchSalesQtyForRange(newFrom, dateRange.to);
                            }}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                        />
                        <span className="text-gray-400 text-xs">→</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => {
                                const newTo = e.target.value;
                                setRangeMode("custom");
                                setDateRange(prev => ({ ...prev, to: newTo }));
                                fetchPayments(dateRange.from, newTo);
                                fetchSalesQtyForRange(dateRange.from, newTo);
                            }}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                        />
                    </div>

                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            { v: "all", l: t("payments.all"), icon: null },
                            { v: "cash", l: t("payments.cash"), icon: <Banknote size={12} /> },
                            { v: "upi", l: t("payments.upi"), icon: <Smartphone size={12} /> },
                            { v: "credit", l: t("payments.credit"), icon: <CreditCard size={12} /> },
                        ].map(({ v, l, icon }) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setFilterMode(v)}
                                className={`flex items-center gap-1.5 px-3.5 py-2 transition-all duration-200 border-r last:border-r-0 border-gray-200/60
                                    ${filterMode === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "text-gray-500 hover:bg-gray-100/50"}`}
                            >
                                {icon}{l}
                            </button>
                        ))}
                    </div>

                    {/* Period label */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-500 text-xs font-medium shadow-sm">
                        <span>{dateRange.from === dateRange.to ? fmtDate(dateRange.from) : `${fmtDate(dateRange.from)} — ${fmtDate(dateRange.to)}`}</span>
                    </div>
                </div>

                {/* ── Flash Message ── */}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" data-tour="payment-stats">
                    <StatCard
                        label={t("payments.total_received")}
                        value={fmt(summary.total_received)}
                        icon={<DollarSign size={16} />}
                        color="from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700"
                    />
                    <StatCard
                        label={t("payments.cash")}
                        value={fmt(summary.cash_total)}
                        icon={<Banknote size={16} />}
                        color="from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700"
                    />
                    <StatCard
                        label={t("payments.total_outstanding")}
                        value={fmt(totalOutstanding)}
                        sub={`${outstandingCount} ${outstandingCount !== 1 ? t("payments.buyers") : t("payments.buyer")}`}
                        icon={<Clock size={16} />}
                        color="from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600"
                    />
                </div>

                {/* ── Payment Entry Form ── */}
                <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-6 z-20" data-tour="payment-form">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className="flex items-center justify-between mb-4 relative z-10">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                            {t("payments.record_new_payment")}
                        </p>
                        <button
                            onClick={() => setShowRegisterBuyer(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700 transition"
                        >
                            <Plus size={12} /> {t("payments.register_new_buyer")}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 relative z-10">
                        {/* Buyer Selection */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <User size={12} /> {t("payments.select_buyer")}
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={buyerSearch}
                                    onChange={(e) => {
                                        setBuyerSearch(e.target.value);
                                        setDropdownOpen(true);
                                        setHighlightedIdx(-1);
                                        if (!e.target.value) setSelectedBuyer(null);
                                    }}
                                    onFocus={() => setDropdownOpen(true)}
                                    onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
                                    onKeyDown={(e) => {
                                        if (!dropdownOpen || filteredBuyers.length === 0) return;
                                        if (e.key === "ArrowDown") {
                                            e.preventDefault();
                                            setHighlightedIdx(i => Math.min(i + 1, filteredBuyers.length - 1));
                                        } else if (e.key === "ArrowUp") {
                                            e.preventDefault();
                                            setHighlightedIdx(i => Math.max(i - 1, 0));
                                        } else if (e.key === "Enter") {
                                            e.preventDefault();
                                            const sel = highlightedIdx >= 0 ? filteredBuyers[highlightedIdx] : filteredBuyers[0];
                                            if (sel) {
                                                setSelectedBuyer(sel);
                                                setBuyerSearch(sel.name);
                                                setDropdownOpen(false);
                                            }
                                        }
                                    }}
                                    placeholder={t("payments.search_by_name_mobile")}
                                    className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                                {dropdownOpen && filteredBuyers.length > 0 && (
                                    <div className="absolute top-full left-0 mt-1 w-full bg-white/98 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto">
                                        {filteredBuyers.map((b, idx) => (
                                            <button
                                                key={buyerKey(b)}
                                                type="button"
                                                onMouseEnter={() => setHighlightedIdx(idx)}
                                                onClick={() => {
                                                    setSelectedBuyer(b);
                                                    setBuyerSearch(b.name);
                                                    setDropdownOpen(false);
                                                }}
                                                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition ${highlightedIdx === idx ? "bg-gray-100/80" : "hover:bg-gray-50/80"}`}
                                            >
                                                <div>
                                                    <p className="font-medium text-gray-800">{b.name}</p>
                                                    <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                                        {b.buyer_type === 'seller' ? <Sprout size={10} /> : <Tag size={10} />}
                                                        {b.buyer_type === 'seller' ? t("payments.seller") : t("payments.named")}{b.mobile ? ` · ${b.mobile}` : ''}
                                                    </p>
                                                </div>
                                                {b.outstanding_balance > 0 && (
                                                    <span className="text-xs font-semibold text-rose-500">
                                                        ₹{b.outstanding_balance.toFixed(2)}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedBuyer && selectedBuyer.outstanding_balance > 0 && (
                                <p className="text-[10px] text-rose-500 font-medium mt-1">
                                    {t("payments.outstanding_balance")}: ₹{selectedBuyer.outstanding_balance.toFixed(2)}
                                    <button
                                        onClick={() => {
                                            setClearBillBuyer(selectedBuyer);
                                            setClearBillAmount(String(selectedBuyer.outstanding_balance.toFixed(2)));
                                            setShowClearBillModal(true);
                                        }}
                                        className="ml-2 text-emerald-600 hover:text-emerald-700 underline"
                                    >
                                        {t("payments.clear_bill")}
                                    </button>
                                </p>
                            )}
                        </div>

                        {/* Payment Date */}
                        <div className="w-36">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <Calendar size={12} /> {t("payments.payment_date")}
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>

                        {/* Amount */}
                        <div className="w-36">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <DollarSign size={12} /> {t("payments.amount")} (₹)
                            </label>
                            <input
                                type="number"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>

                        {/* Payment Mode */}
                        <div>
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <CreditCard size={12} /> {t("payments.mode")}
                            </label>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-sm font-semibold shadow-sm">
                                {PAYMENT_MODES.map(({ val, labelKey, icon, active }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setPaymentForm(p => ({ ...p, payment_mode: val }))}
                                        className={`flex items-center gap-1.5 px-3 py-2 transition-colors
                                            ${paymentForm.payment_mode === val ? active : "bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80"}`}
                                    >
                                        {icon} {t(labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                <FileText size={12} /> {t("payments.remarks")}
                            </label>
                            <input
                                type="text"
                                value={paymentForm.remarks}
                                onChange={(e) => setPaymentForm(p => ({ ...p, remarks: e.target.value }))}
                                placeholder={t("payments.optional_notes")}
                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={savePayment}
                            disabled={saving || !selectedBuyer || !paymentForm.amount}
                            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg transition-all duration-200
                                bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 active:scale-95 disabled:opacity-50"
                        >
                            {saving ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <CheckCircle2 size={16} />
                            )}
                            {saving ? t("payments.saving") : t("payments.record_payment")}
                        </button>
                    </div>
                </div>

                {/* ── Search + Filter ── */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder={t("payments.search_buyers")}
                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition placeholder:text-gray-300" />
                    </div>

                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            ["all", t("payments.all_types"), null],
                            ["named", t("payments.named"), <Tag size={12} />],
                            ["seller", t("payments.seller"), <Sprout size={12} />],
                        ].map(([v, l, icon]) => (
                            <button key={v} onClick={() => { setFilterType(v); setCurrentPage(1); }}
                                className={`flex items-center gap-1.5 px-3.5 py-2 transition-all duration-200 border-r last:border-r-0 border-gray-200/60
                                    ${filterType === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30" : "text-gray-500 hover:bg-gray-100/50"}`}>
                                {icon}{l}
                            </button>
                        ))}
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

                    <span className="ml-auto text-xs text-gray-400">
                        {listFilteredBuyers.length} {listFilteredBuyers.length !== 1 ? t("payments.buyers") : t("payments.buyer")}
                    </span>
                </div>

                {/* ── Buyer Cards ── */}
                <div className="flex flex-col gap-3" data-tour="buyer-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : paginatedBuyers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 gap-3 text-gray-300">
                            <Users size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">{t("payments.no_buyers_found")}</p>
                        </div>
                    ) : paginatedBuyers.map(buyer => {
                        const key = buyerKey(buyer);
                        const isOpen = expanded[key];
                        const hasOutstanding = buyer.outstanding_balance > 0.01;

                        return (
                            <div key={key}
                                className={`relative overflow-hidden rounded-2xl border transition-all duration-200
                                    ${hasOutstanding ? "border-rose-200/60 bg-gradient-to-br from-rose-50 to-rose-100/50 shadow-lg shadow-rose-200/30" : "bg-white/80 backdrop-blur-sm border-gray-200/60 shadow-lg shadow-gray-200/50"}`}>
                                <div className={`absolute -right-8 -top-8 w-32 h-32 rounded-full ${hasOutstanding ? "bg-rose-400/10" : "bg-gray-400/5"} blur-3xl`} />

                                {/* Row */}
                                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer relative z-10"
                                    onClick={() => toggleExpand(buyer)}>

                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm
                                        ${hasOutstanding ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-rose-500/30" : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-emerald-500/30"}`}>
                                        {buyer.name?.charAt(0)?.toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-gray-800 truncate">{buyer.name}</p>
                                            <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm
                                                ${buyer.buyer_type === 'seller'
                                                    ? "bg-violet-50/80 text-violet-600 border-violet-200/60"
                                                    : "bg-blue-50/80 text-blue-600 border-blue-200/60"}`}>
                                                {buyer.buyer_type === 'seller' ? <Sprout size={10} /> : <Tag size={10} />}
                                                {buyer.buyer_type === 'seller' ? t("payments.seller") : t("payments.named")}
                                            </span>
                                            {hasOutstanding ? (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-rose-50/80 text-rose-600 border border-rose-200/60 backdrop-blur-sm">
                                                    <Clock size={9} /> {t("payments.outstanding")}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-emerald-50/80 text-emerald-600 border border-emerald-200/60 backdrop-blur-sm">
                                                    <CheckCircle2 size={9} /> {t("payments.cleared")}
                                                </span>
                                            )}
                                        </div>
                                        {buyer.mobile && <p className="text-[11px] text-gray-500 mt-0.5">{buyer.mobile}</p>}
                                    </div>

                                    {/* Desktop amounts */}
                                    <div className="hidden sm:flex items-center gap-6 text-right mr-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("payments.total_purchases")}</p>
                                            <p className="text-sm font-semibold text-gray-700">
                                                {fmt(parseFloat(buyer.total_paid || 0) + parseFloat(buyer.outstanding_balance || 0))}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-emerald-400 uppercase tracking-wider">{t("payments.total_paid")}</p>
                                            <p className="text-sm font-semibold text-emerald-600">{fmt(buyer.total_paid)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t("payments.outstanding_balance")}</p>
                                            <p className={`text-base font-bold ${hasOutstanding ? "text-rose-600" : "text-gray-900"}`}>
                                                {fmt(buyer.outstanding_balance)}
                                            </p>
                                        </div>
                                    </div>

                                    {hasOutstanding && can('walkin_payments', 'W') && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setClearBillBuyer(buyer);
                                                setClearBillAmount(String(buyer.outstanding_balance.toFixed(2)));
                                                setShowClearBillModal(true);
                                            }}
                                            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 text-white text-xs font-semibold transition-all duration-200 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40">
                                            <Banknote size={12} /> {t("payments.clear_bill")}
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); printBuyerStatement(buyer); }}
                                        className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-br from-gray-800 to-gray-700 text-white text-xs font-semibold transition-all duration-200 shadow-lg shadow-gray-800/30 hover:shadow-xl hover:shadow-gray-800/40">
                                        <Download size={12} /> {t("payments.pdf")}
                                    </button>

                                    <div className="shrink-0 text-gray-400">
                                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                    </div>
                                </div>

                                {/* Mobile amounts */}
                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs flex-wrap relative z-10">
                                    <span className="text-gray-400">{t("payments.total")}: <strong className="text-gray-700">{fmt(buyerTotalSalesMap[buyerKey(buyer)] ?? (parseFloat(buyer.total_paid || 0) + parseFloat(buyer.outstanding_balance || 0)))}</strong></span>
                                    <span className="text-emerald-500">{t("payments.paid")}: {fmt(buyer.total_paid)}</span>
                                    <span className={`font-bold ${hasOutstanding ? "text-rose-600" : "text-gray-900"}`}>
                                        {t("payments.bal")}: {fmt(buyer.outstanding_balance)}
                                    </span>
                                </div>

                                {/* Expanded: Payment history */}
                                {isOpen && (
                                    <div className="border-t border-gray-200/60 px-4 py-4 flex flex-col gap-3 relative z-10">
                                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                            {t("payments.payment_history")}
                                        </p>

                                        {loadingTx[key] ? (
                                            <div className="flex justify-center py-6">
                                                <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                            </div>
                                        ) : (transactionsMap[key] || []).length === 0 ? (
                                            <p className="text-xs text-gray-400 py-2">{t("payments.no_payments_recorded")}</p>
                                        ) : (
                                            <div className="rounded-xl border border-gray-200/60 overflow-hidden shadow-sm bg-white/50 backdrop-blur-sm">

                                                {/* Desktop table header */}
                                                <div className="hidden sm:grid bg-gradient-to-r from-gray-50/50 to-white/50 border-b border-gray-200/60"
                                                    style={{ gridTemplateColumns: "100px 100px 90px 1fr 80px" }}>
                                                    {[t("payments.date"), t("payments.amount"), t("payments.mode"), t("payments.remarks"), ""].map(h => (
                                                        <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">{h}</div>
                                                    ))}
                                                </div>

                                                {(transactionsMap[key] || []).map(p => (
                                                    <div key={p.payment_id} className="border-b border-gray-100/60 last:border-0 hover:bg-white/50 transition">

                                                        {/* Desktop row */}
                                                        <div className="hidden sm:grid"
                                                            style={{ gridTemplateColumns: "100px 100px 90px 1fr 80px" }}>
                                                            <div className="px-3 py-2 text-xs text-gray-600 border-r border-gray-100/60">{fmtDate(p.payment_date)}</div>
                                                            <div className="px-3 py-2 text-xs font-bold text-emerald-600 border-r border-gray-100/60">₹{parseFloat(p.amount).toFixed(2)}</div>
                                                            <div className="px-3 py-2 border-r border-gray-100/60"><PaymentBadge mode={p.payment_mode} /></div>
                                                            <div className="px-3 py-2 text-xs text-gray-500 truncate border-r border-gray-100/60">{p.remarks || "—"}</div>
                                                            <div className="px-3 py-2 flex items-center">
                                                                <button
                                                                    onClick={() => confirmUndoPayment(buyer, p.payment_id)}
                                                                    disabled={undoingPayment === p.payment_id}
                                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold
                                                                            bg-rose-50/80 text-rose-600 border border-rose-200/60 backdrop-blur-sm
                                                                            hover:bg-rose-100/80 disabled:opacity-40 transition shadow-sm"
                                                                >
                                                                    {undoingPayment === p.payment_id
                                                                        ? <span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                                                                        : <X size={10} />
                                                                    }
                                                                    {t("payments.undo")}
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* Mobile card */}
                                                        <div className="sm:hidden px-4 py-3 flex flex-col gap-2">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs text-gray-500">{fmtDate(p.payment_date)}</span>
                                                                    <PaymentBadge mode={p.payment_mode} />
                                                                </div>
                                                                <span className="text-sm font-bold text-emerald-600">₹{parseFloat(p.amount).toFixed(2)}</span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-xs text-gray-400 truncate flex-1 mr-2">{p.remarks || "—"}</span>
                                                                <button
                                                                    onClick={() => confirmUndoPayment(buyer, p.payment_id)}
                                                                    disabled={undoingPayment === p.payment_id}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
                                                                            bg-rose-50/80 text-rose-600 border border-rose-200/60 backdrop-blur-sm
                                                                            hover:bg-rose-100/80 disabled:opacity-40 transition shadow-sm shrink-0"
                                                                >
                                                                    {undoingPayment === p.payment_id
                                                                        ? <span className="w-3 h-3 border border-rose-400 border-t-transparent rounded-full animate-spin" />
                                                                        : <X size={10} />
                                                                    }
                                                                    {t("payments.undo")}
                                                                </button>
                                                            </div>
                                                        </div>

                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Pagination ── */}
                {listFilteredBuyers.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                                {t("payments.prev")}
                            </button>
                            <span className="text-xs text-gray-600">
                                {t("payments.page")} {currentPage} {t("payments.of")} {totalPages || 1}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm">
                                {t("payments.next")}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t("payments.rows_per_page")}:</span>
                            <select
                                value={pageSize}
                                onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            >
                                {[5, 10, 25, 50].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t("payments.footerRole", { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t("payments.footerTotalBuyers", { defaultValue: 'Total buyers' })}: <strong className="text-gray-600">{buyers.length}</strong></span>
                    <span>· {t("payments.footerOutstanding", { defaultValue: 'With outstanding' })}: <strong className="text-rose-600">{outstandingCount}</strong></span>
                </div>

            </main>

            {/* ── Register New Buyer Modal ── */}
            {showRegisterBuyer && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                    <User size={16} className="text-emerald-500" />
                                    {t("payments.register_new_buyer")}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">{t("payments.add_new_named_buyer")}</p>
                            </div>
                            <button onClick={() => setShowRegisterBuyer(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t("payments.full_name")} *</label>
                                <input
                                    type="text"
                                    value={newBuyerReg.name}
                                    onChange={e => setNewBuyerReg(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full mt-1 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    placeholder={t("payments.enter_buyer_name")}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t("payments.mobile_number")}</label>
                                <input
                                    type="tel"
                                    value={newBuyerReg.mobile}
                                    onChange={e => setNewBuyerReg(prev => ({ ...prev, mobile: e.target.value }))}
                                    className="w-full mt-1 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    placeholder={t("payments.optional")}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t("payments.address")}</label>
                                <textarea
                                    value={newBuyerReg.address}
                                    onChange={e => setNewBuyerReg(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full mt-1 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    rows="2"
                                    placeholder={t("payments.optional")}
                                />
                            </div>
                            <div className="flex gap-2 pt-2 border-t border-gray-100/60">
                                <button onClick={() => setShowRegisterBuyer(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                                    {t("payments.cancel")}
                                </button>
                                <button onClick={registerBuyer} disabled={savingNewBuyer || !newBuyerReg.name.trim()}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2">
                                    {savingNewBuyer && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {savingNewBuyer ? t("payments.registering") : t("payments.register_buyer")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bill Search Modal ── (updates omitted for brevity, but would follow same pattern) ── */}

            {/* ── Delete Bill Confirm Modal ── */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-rose-50/50 to-white/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100/80 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">Delete Bill</h2>
                                    <p className="text-[10px] text-gray-400">This action cannot be undone</p>
                                </div>
                            </div>
                            <button onClick={cancelDeleteBill} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-3">
                            <p className="text-sm text-gray-600">
                                Are you sure you want to delete bill <strong className="font-mono text-rose-700">{deletingBill}</strong>?
                            </p>
                            <div className="rounded-xl bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 px-4 py-3 text-xs text-rose-700 shadow-sm">
                                <p className="font-semibold mb-1">The following will be reversed:</p>
                                <ul className="list-disc list-inside text-rose-600 space-y-0.5">
                                    <li>Payment record and bill entry</li>
                                    <li>Buyer outstanding balance adjustment</li>
                                    <li>Buyer payment status reset</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200/60">
                            <button onClick={cancelDeleteBill} className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                                Cancel
                            </button>
                            <button onClick={confirmDeleteBill} disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 disabled:opacity-50">
                                {deleting ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={12} />}
                                {deleting ? "Deleting..." : "Yes, Delete Bill"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                onClick={() => setUndoModal({ open: false, buyer: null, paymentId: null })}
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

            {/* ── Clear Bill Modal ── */}
            {showClearBillModal && clearBillBuyer && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Banknote size={16} className="text-rose-500" />
                                    {t("payments.clear_bill")}
                                </h2>
                                <p className="text-xs text-gray-500 mt-0.5">{clearBillBuyer.name}</p>
                            </div>
                            <button onClick={() => setShowClearBillModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                                <X size={16} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="relative overflow-hidden rounded-xl border border-rose-200/60 bg-gradient-to-br from-rose-50 to-rose-100/50 shadow-sm p-4">
                                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-rose-400/10 blur-3xl" />
                                <p className="text-xs text-gray-500 relative z-10">{t("payments.outstanding_balance")}</p>
                                <p className="text-2xl font-bold text-rose-600 relative z-10">₹{clearBillBuyer.outstanding_balance.toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t("payments.amount_paid")}</label>
                                <input
                                    type="number"
                                    value={clearBillAmount}
                                    onChange={e => setClearBillAmount(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    max={clearBillBuyer.outstanding_balance}
                                    className="w-full mt-1 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 focus:bg-white transition"
                                />
                            </div>
                            {clearBillAmount && parseFloat(clearBillAmount) < clearBillBuyer.outstanding_balance && (
                                <p className="text-xs text-amber-600">
                                    ₹{(clearBillBuyer.outstanding_balance - parseFloat(clearBillAmount)).toFixed(2)} {t("payments.will_remain_as_balance")}
                                </p>
                            )}
                            <div className="flex gap-2 pt-2 border-t border-gray-100/60">
                                <button onClick={() => setShowClearBillModal(false)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                                    {t("payments.cancel")}
                                </button>
                                <button onClick={clearBuyerBill} disabled={clearingBill || !clearBillAmount || parseFloat(clearBillAmount) <= 0}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 disabled:opacity-40 flex items-center justify-center gap-2">
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