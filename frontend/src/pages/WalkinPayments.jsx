// WalkinPayments.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Wallet, ChevronDown, ChevronUp, Download, Plus,
    BadgeCheck, AlertTriangle, X, User, Users,
    Banknote, Smartphone, CreditCard, DollarSign,
    CheckCircle2, Clock, Search, Calendar, FileText,
    FileSearch, Hash, Trash2, Printer, RefreshCw
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
    { val: "cash", labelKey: "payments.cash", icon: <Banknote size={13} />, active: "bg-emerald-500 text-white border-emerald-500" },
    { val: "upi", labelKey: "payments.upi", icon: <Smartphone size={13} />, active: "bg-blue-500 text-white border-blue-500" },
    { val: "credit", labelKey: "payments.credit", icon: <CreditCard size={13} />, active: "bg-orange-500 text-white border-orange-500" },
];

const buyerKey = (b) => b.buyer_type === 'seller' ? `s-${b.seller_id}` : `b-${b.buyer_id}`;

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
    const config = {
        cash: "bg-emerald-50 text-emerald-700 border-emerald-100",
        upi: "bg-blue-50 text-blue-700 border-blue-100",
        credit: "bg-orange-50 text-orange-700 border-orange-100",
    };
    const labels = { cash: t("payments.cash"), upi: t("payments.upi"), credit: t("payments.credit") };
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${config[mode]}`}>
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
    const [savingBill, setSavingBill] = useState(null);    

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

    const handleSaveBill = async (e, buyer) => {
        e.stopPropagation();
        const key = buyerKey(buyer);
        if (savingBill) return;
        setSavingBill(key);
        try {
            const { data } = await api.post('/walkin-payments/bills/save', {
                buyer_id: buyer.buyer_type === 'named' ? buyer.buyer_id : null,
                seller_id: buyer.buyer_type === 'seller' ? buyer.seller_id : null,
                buyer_type: buyer.buyer_type,
                from_date: dateRange.from,
                to_date: dateRange.to,
                amount_paid: parseFloat(buyer.outstanding_balance || 0),
            });
            showFlash('success', `Bill ${data.bill_no} saved! Remaining: ₹${parseFloat(data.remaining_balance).toFixed(2)}`);
            await fetchBuyers();
            await fetchPayments(dateRange.from, dateRange.to);
        } catch (err) {
            showFlash('error', err.response?.data?.error || 'Failed to save bill.');
        } finally {
            setSavingBill(null);
        }
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

            // ── Auto-save bill after successful clear ──────────────────
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
                // Bill already exists for this period — not a fatal error
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

    const undoPayment = async (buyer, paymentId) => {
        if (!window.confirm(t("payments.undo_payment_confirm"))) return;
        const key = buyerKey(buyer);
        setUndoingPayment(paymentId);
        try {
            await api.delete(`/walkin-payments/payments/${paymentId}`);
            showFlash("success", t("payments.payment_undone_success"));
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
            setUndoingPayment(null);
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
        // ── 1. Fetch sales for the range ──────────────────────────────
        let localSalesQtyMap = {};
        let localSalesAmtMap = {};
        let localPersonRows = {};

        try {
            const { data: salesData } = await api.get(`/walkin-sales?from=${dateRange.from}&to=${dateRange.to}`);
            salesData.forEach(s => {
                const pk = s.seller_id ? `s-${s.seller_id}` : s.buyer_id ? `b-${s.buyer_id}` : null;
                if (!pk) return;
                if (!s.sale_date) return;
                const dateKey = String(s.sale_date).split("T")[0].slice(0, 10);
                if (dateKey.length !== 10) return;
                const milkType = s.milk_type || "cow";
                const shift = s.shift || "morning";
                const rowKey = `${pk}_${milkType}_${shift}`;
                const cellKey = `${rowKey}_${dateKey}`;
                localSalesQtyMap[cellKey] = (localSalesQtyMap[cellKey] || 0) + parseFloat(s.quantity || 0);
                if (!localSalesAmtMap[rowKey]) localSalesAmtMap[rowKey] = { qty: 0, saleAmt: 0, rate: parseFloat(s.mrp || 0) };
                localSalesAmtMap[rowKey].qty += parseFloat(s.quantity || 0);
                localSalesAmtMap[rowKey].saleAmt += parseFloat(s.total_amount || 0);
                if (!localPersonRows[pk]) localPersonRows[pk] = [];
                const exists = localPersonRows[pk].find(r => r.milkType === milkType && r.shift === shift);
                if (!exists) {
                    localPersonRows[pk].push({
                        milkType, shift,
                        name: s.registered_buyer_name || s.seller_name || s.buyer_name || "Unknown",
                        buyerType: s.seller_id ? "seller" : "named",
                        seller_id: s.seller_id || "",
                        buyer_id: s.buyer_id || "",
                    });
                }
            });
            Object.keys(localPersonRows).forEach(pk => {
                localPersonRows[pk].sort((a, b) => {
                    if (a.shift !== b.shift) return a.shift === "morning" ? -1 : 1;
                    return a.milkType === "cow" ? -1 : 1;
                });
            });
        } catch (e) { console.error("Failed to fetch sales:", e); }

        // ── 2. Opening balance ────────────────────────────────────────
        let openingBalanceMap = {};
        try {
            const dayBeforeRange = (() => {
                const d = new Date(dateRange.from + "T00:00:00");
                d.setDate(d.getDate() - 1);
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            })();
            const { data: prevSales } = await api.get(`/walkin-sales?from=2000-01-01&to=${dayBeforeRange}`);
            const { data: prevPayments } = await api.get(`/walkin-payments/payments?from=2000-01-01&to=${dayBeforeRange}`);
            const purchaseMap = {};
            prevSales.forEach(s => {
                const pk = s.seller_id ? `s-${s.seller_id}` : s.buyer_id ? `b-${s.buyer_id}` : null;
                if (!pk) return;
                purchaseMap[pk] = (purchaseMap[pk] || 0) + parseFloat(s.total_amount || 0);
            });
            const paidMap = {};
            prevPayments.forEach(p => {
                const pk = p.seller_id ? `s-${p.seller_id}` : p.buyer_id ? `b-${p.buyer_id}` : null;
                if (!pk) return;
                paidMap[pk] = (paidMap[pk] || 0) + parseFloat(p.amount || 0);
            });
            const allPks = new Set([...Object.keys(purchaseMap), ...Object.keys(paidMap)]);
            allPks.forEach(pk => {
                const owed = (purchaseMap[pk] || 0) - (paidMap[pk] || 0);
                openingBalanceMap[pk] = owed > 0.005 ? owed : 0;
            });
        } catch (e) { console.error("Failed to fetch opening balances:", e); }

        // ── 2b. Saved bills for this range ────────────────────────────
        let savedBillsMap = {}; // personKey → { bill_no, paid_at, remaining_balance }
        try {
            const { data: billsData } = await api.get(
                `/walkin-payments/bills/search?q=`
            );
            billsData.forEach(b => {
                // only include bills whose period overlaps the selected range
                if (b.to_date < dateRange.from || b.from_date > dateRange.to) return;
                const pk = b.buyer_type === 'seller'
                    ? `s-${b.seller_id}`
                    : `b-${b.buyer_id}`;
                if (!pk || pk === 's-null' || pk === 'b-null') return;
                savedBillsMap[pk] = {
                    bill_no: b.bill_no,
                    paid_at: b.paid_at,
                    remaining_balance: parseFloat(b.remaining_balance || 0),
                };
            });
        } catch (e) { console.error("Failed to fetch saved bills:", e); }

        // ── 3. Payments for period ────────────────────────────────────
        let allPayments = [];
        try {
            const { data: freshPayments } = await api.get(`/walkin-payments/payments?from=${dateRange.from}&to=${dateRange.to}`);
            allPayments = freshPayments;
        } catch (e) { allPayments = payments; }
        const filtered = filterMode === "all" ? allPayments : allPayments.filter(p => p.payment_mode === filterMode);

        // ── 4. Build allDates ─────────────────────────────────────────
        const pad = (n) => String(n).padStart(2, "0");
        const allDatesSet = new Set();
        filtered.forEach(p => {
            const dk = String(p.payment_date || "").split("T")[0].slice(0, 10);
            if (dk && dk.length === 10 && dk >= dateRange.from && dk <= dateRange.to) allDatesSet.add(dk);
        });
        Object.keys(localSalesQtyMap).forEach(k => {
            const m = k.match(/(\d{4}-\d{2}-\d{2})$/);
            if (m && m[1] >= dateRange.from && m[1] <= dateRange.to) allDatesSet.add(m[1]);
        });
        {
            const start = new Date(dateRange.from + "T00:00:00");
            const end = new Date(dateRange.to + "T00:00:00");
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                allDatesSet.add(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
            }
        }
        const allDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));
        const D = allDates.length;

        // ── 5. Buyer lookup ───────────────────────────────────────────
        const buyerLookup = {};
        buyers.forEach(b => {
            if (b.buyer_type === "seller" && b.seller_id) buyerLookup[`s-${b.seller_id}`] = b;
            else if (b.buyer_type === "named" && b.buyer_id) buyerLookup[`b-${b.buyer_id}`] = b;
        });

        // ── 6. Payment map per person ─────────────────────────────────
        const personPaymentMap = {};
        allPayments.forEach(p => {
            const pk = p.seller_id ? `s-${p.seller_id}` : p.buyer_id ? `b-${p.buyer_id}` : null;
            if (!pk) return;
            if (!personPaymentMap[pk]) personPaymentMap[pk] = { totalAmt: 0, entries: {}, modes: new Set() };
            const dk = String(p.payment_date || "").split("T")[0].slice(0, 10);
            personPaymentMap[pk].entries[dk] = (personPaymentMap[pk].entries[dk] || 0) + parseFloat(p.amount || 0);
            personPaymentMap[pk].totalAmt += parseFloat(p.amount || 0);
            personPaymentMap[pk].modes.add(p.payment_mode || "cash");
        });

        // ── 7. Build sellersList ──────────────────────────────────────
        const allPersonKeys = new Set([...Object.keys(localPersonRows), ...Object.keys(personPaymentMap)]);
        const sellersList = [];
        allPersonKeys.forEach(pk => {
            const buyerData = buyerLookup[pk];
            const rows = localPersonRows[pk];
            if (rows && rows.length > 0) {
                rows.forEach(r => {
                    sellersList.push({
                        personKey: pk, milkType: r.milkType, shift: r.shift,
                        name: buyerData ? buyerData.name : r.name,
                        buyer_type: buyerData ? buyerData.buyer_type : r.buyerType,
                        seller_id: r.seller_id, buyer_id: r.buyer_id,
                    });
                });
            } else if (personPaymentMap[pk] && buyerData) {
                sellersList.push({
                    personKey: pk, milkType: "—", shift: "—", name: buyerData.name,
                    buyer_type: buyerData.buyer_type,
                    seller_id: buyerData.seller_id || "", buyer_id: buyerData.buyer_id || "",
                });
            }
        });
        sellersList.sort((a, b) => {
            const nc = a.name.localeCompare(b.name);
            if (nc !== 0) return nc;
            if (a.shift !== b.shift) return a.shift === "morning" ? -1 : 1;
            return a.milkType === "cow" ? -1 : 1;
        });

        // ── 8. Per-person aggregates ──────────────────────────────────
        const personKeys = [];
        const personRowCount = {};
        sellersList.forEach(s => {
            if (!personRowCount[s.personKey]) { personKeys.push(s.personKey); personRowCount[s.personKey] = 0; }
            personRowCount[s.personKey]++;
        });

        const rowTotalQty = {};
        sellersList.forEach(s => {
            const rk = `${s.personKey}_${s.milkType}_${s.shift}`;
            rowTotalQty[rk] = allDates.reduce((sum, d) => sum + (localSalesQtyMap[`${rk}_${d}`] || 0), 0);
        });

        const personSalesAmt = {};
        personKeys.forEach(pk => {
            personSalesAmt[pk] = sellersList.filter(s => s.personKey === pk).reduce((sum, s) => {
                const rk = `${s.personKey}_${s.milkType}_${s.shift}`;
                const rqty = rowTotalQty[rk] || 0;
                const rd = localSalesAmtMap[rk];
                const rate = rd && rd.qty > 0 ? rd.saleAmt / rd.qty : 0;
                return sum + rqty * rate;
            }, 0);
        });

        const personLastPaymentDate = {};
        filtered.forEach(p => {
            const pk = p.seller_id ? `s-${p.seller_id}` : p.buyer_id ? `b-${p.buyer_id}` : null;
            if (!pk) return;
            const dk = String(p.payment_date || "").split("T")[0].slice(0, 10);
            if (!personLastPaymentDate[pk] || dk > personLastPaymentDate[pk]) personLastPaymentDate[pk] = dk;
        });

        // ── 9. Labels ─────────────────────────────────────────────────
        const fmtD = (d) => d ? new Date(String(d).split("T")[0] + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        const modeLabel = rangeMode === "daily" ? t("payments.daily") : rangeMode === "weekly" ? t("payments.weekly") : rangeMode === "monthly" ? t("payments.monthly") : t("payments.custom");
        const filterLabel = filterMode === "all" ? t("payments.all_modes") : filterMode === "cash" ? t("payments.cash_only") : filterMode === "upi" ? t("payments.upi_only") : t("payments.credit_only");
        const periodLabel = dateRange.from === dateRange.to ? fmtD(dateRange.from) : `${fmtD(dateRange.from)} – ${fmtD(dateRange.to)}`;

        const totalAmt = filtered.reduce((a, p) => a + parseFloat(p.amount || 0), 0);
        const cashAmt = filtered.filter(p => p.payment_mode === "cash").reduce((a, p) => a + parseFloat(p.amount || 0), 0);
        const upiAmt = filtered.filter(p => p.payment_mode === "upi").reduce((a, p) => a + parseFloat(p.amount || 0), 0);
        const creditAmt = filtered.filter(p => p.payment_mode === "credit").reduce((a, p) => a + parseFloat(p.amount || 0), 0);
        const monthLabel = allDates.length > 0
            ? new Date(allDates[0] + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" })
            : new Date(dateRange.from + "T00:00:00").toLocaleDateString("en-IN", { month: "long", year: "numeric" });

        // ── 10. Open window ───────────────────────────────────────────
        const win = window.open("", "_blank", "width=1600,height=900");
        if (!win) return;

        // ── 11. Header date columns ───────────────────────────────────
        const headerDateCols = allDates.map(d => {
            const dayNum = String(new Date(d + "T00:00:00").getDate()).padStart(2, "0");
            return `<th class="th-date">${dayNum}</th>`;
        }).join("");

        // ── 12. Body rows ─────────────────────────────────────────────
        const personRendered = {};
        const bodyRows = sellersList.map((seller) => {
            const pk = seller.personKey;
            const isFirstRow = !personRendered[pk];
            if (isFirstRow) personRendered[pk] = true;

            const rowspan = personRowCount[pk];
            const rowBg = personKeys.indexOf(pk) % 2 === 0 ? "#ffffff" : "#f8fafc";

            const typeLabel = seller.buyer_type === "named" ? "Named" : "Seller";
            const typeCls = seller.buyer_type === "named" ? "badge-named" : "badge-seller";
            const milkTypeLabel = seller.milkType === "cow" ? "C" : seller.milkType === "buffalo" ? "B" : "—";
            const shiftLabel = seller.shift === "morning" ? "M" : seller.shift === "evening" ? "E" : "—";

            const rowKey = `${pk}_${seller.milkType}_${seller.shift}`;
            const rowQty = allDates.reduce((sum, d) => sum + (localSalesQtyMap[`${rowKey}_${d}`] || 0), 0);
            const rowAmt = allDates.reduce((sum, d) => {
                const cellQty = localSalesQtyMap[`${rowKey}_${d}`] || 0;
                const rData = localSalesAmtMap[rowKey];
                const rate = rData && rData.qty > 0 ? rData.saleAmt / rData.qty : 0;
                return sum + cellQty * rate;
            }, 0);
            const rData = localSalesAmtMap[rowKey];
            const rowRate = rData && rData.qty > 0 ? rData.saleAmt / rData.qty : 0;

            const dateCells = allDates.map(dateStr => {
                const qty = localSalesQtyMap[`${rowKey}_${dateStr}`];
                // Show full number — no truncation
                const formatted = qty != null ? qty.toFixed(1) : "";
                return `<td class="td-qty" style="background:${rowBg}">${formatted}</td>`;
            }).join("");

            const personTotalSalesAmt = personSalesAmt[pk] || 0;
            const openingBalTotal = openingBalanceMap[pk] || 0;
            const openingBalRow = isFirstRow ? openingBalTotal : 0;
            const totalAmtValue = isFirstRow ? (rowAmt + openingBalTotal) : rowAmt;
            const paidThisPeriod = isFirstRow ? (personPaymentMap[pk]?.totalAmt || 0) : 0;
            const buyerData = buyerLookup[pk];
            const outstandingFinal = buyerData ? parseFloat(buyerData.outstanding_balance || 0) : 0;

            const prevRemaining = (isFirstRow && openingBalTotal > 0.005) ? `₹${openingBalTotal.toFixed(2)}` : "—";
            const totalAmtCell = totalAmtValue > 0.005 ? `₹${totalAmtValue.toFixed(2)}` : "—";
            const paidCell = isFirstRow && paidThisPeriod > 0 ? `₹${paidThisPeriod.toFixed(2)}` : "—";
            const savedBill = savedBillsMap[pk];
            const balanceToShow = savedBill
                ? savedBill.remaining_balance
                : outstandingFinal;
            const restAmount = isFirstRow
                ? (balanceToShow > 0.01 ? `₹${balanceToShow.toFixed(2)}` : `✓ Nil`)
                : "—";
            const lastDate = isFirstRow
                ? (savedBill?.paid_at
                    ? String(savedBill.paid_at).split("T")[0]
                    : (personLastPaymentDate[pk] || ""))
                : "";
            const receiptDate = lastDate ? (() => { const [y, m, d] = lastDate.split("-"); return `${d}/${m}/${String(y).slice(2)}`; })() : "—";
            const totalRowQty = allDates.reduce((sum, d) => sum + (localSalesQtyMap[`${rowKey}_${d}`] || 0), 0);

            return `<tr style="background:${rowBg}">
            ${isFirstRow ? `
            <td rowspan="${rowspan}" class="td-no" style="background:#f8fafc">${personKeys.indexOf(pk) + 1}</td>
            <td rowspan="${rowspan}" class="td-name" style="background:#f8fafc">
                <div class="name-full">${seller.name}</div>
                ${seller.seller_id ? `<div class="name-id">${seller.seller_id}</div>` : ""}
            </td>` : ""}
            <td class="td-attr"><span class="${typeCls}">${typeLabel}</span></td>
            <td class="td-attr td-center">${milkTypeLabel}</td>
            <td class="td-attr td-center">${shiftLabel}</td>
            ${dateCells}
            <td class="td-num td-bold" style="background:#dbeafe;color:#1d4ed8">${totalRowQty > 0 ? totalRowQty.toFixed(2) : "—"}</td>
            <td class="td-num" style="background:${rowBg}">${rowRate > 0 ? `₹${rowRate.toFixed(2)}` : "—"}</td>
            <td class="td-num td-bold" style="background:#f1f5f9">${rowAmt > 0 ? `₹${rowAmt.toFixed(2)}` : "—"}</td>
 <td class="td-center" style="color:${savedBillsMap[pk] ? '#7c3aed' : '#9ca3af'};font-family:monospace;font-size:7px;font-weight:${savedBillsMap[pk] ? '700' : '400'}">
                ${savedBillsMap[pk] ? savedBillsMap[pk].bill_no : '—'}
            </td>
            <td class="td-num td-bold" style="background:#fff5f5;color:#b91c1c">${prevRemaining}</td>
            <td class="td-num td-bold" style="background:#f1f5f9">${totalAmtCell}</td>
            <td class="td-num td-bold" style="background:#eff6ff;color:#1d4ed8">${paidCell}</td>
            <td class="td-center" style="font-size:7px">${receiptDate}</td>
            <td class="td-num td-bold" style="background:#fffbeb;color:#92400e">${restAmount}</td>
        </tr>`;
        }).join("");

        // ── 13. Grand total row ───────────────────────────────────────
        const dateTotals = allDates.map(dateStr => {
            let sum = 0;
            sellersList.forEach(s => {
                const rk = `${s.personKey}_${s.milkType}_${s.shift}`;
                sum += localSalesQtyMap[`${rk}_${dateStr}`] || 0;
            });
            return `<td class="td-qty" style="background:#1e293b;color:#fff;font-weight:700">${sum > 0 ? sum.toFixed(1) : ""}</td>`;
        }).join("");

        const grandTotalQty = sellersList.reduce((a, s) => {
            const rk = `${s.personKey}_${s.milkType}_${s.shift}`;
            return a + allDates.reduce((sum, d) => sum + (localSalesQtyMap[`${rk}_${d}`] || 0), 0);
        }, 0);
        const grandTotalPayments = filtered.reduce((a, p) => a + parseFloat(p.amount || 0), 0);

        const grandTotalRow = `<tr class="grand-total-row">
        <td colspan="5" style="text-align:right;padding:5px 6px">GRAND TOTAL</td>
        ${dateTotals}
        <td class="td-num td-bold" style="background:#1e40af">${grandTotalQty.toFixed(2)} L</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td class="td-num td-bold" style="background:#1e40af">₹${grandTotalPayments.toFixed(2)}</td>
        <td style="text-align:center">—</td>
        <td style="text-align:center">—</td>
    </tr>`;

        // ── 14. Summary badges ────────────────────────────────────────
        const summaryBadges = [
            { label: "Cash", val: `₹${cashAmt.toFixed(2)}`, bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" },
            { label: "UPI", val: `₹${upiAmt.toFixed(2)}`, bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
            { label: "Credit", val: `₹${creditAmt.toFixed(2)}`, bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" },
            { label: "Entries", val: filtered.length, bg: "#f8fafc", border: "#cbd5e1", color: "#0f172a" },
            { label: "Total", val: `₹${totalAmt.toFixed(2)}`, bg: "#f8fafc", border: "#cbd5e1", color: "#0f172a" },
        ].map(({ label, val, bg, border, color }) =>
            `<div style="background:${bg};border:1.5px solid ${border};padding:4px 10px;border-radius:6px;text-align:center;min-width:70px">
            <div style="font-size:8px;color:#6b7280;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px">${label}</div>
            <div style="font-size:12px;font-weight:900;color:${color}">${val}</div>
        </div>`
        ).join("");

        // ── 15. Write HTML ────────────────────────────────────────────
        win.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Walk-in Payments Register — ${periodLabel}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    color: #111;
    margin: 0;
    padding: 10px 14px;
    background: #fff;
  }

  /* ── Header ── */
  .report-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 3px double #1e3a8a;
    gap: 12px;
    flex-wrap: wrap;
  }
  .report-title { font-size: 16px; font-weight: 900; color: #1e3a8a; }
  .report-sub   { font-size: 8px; color: #475569; margin-top: 3px; }
  .report-gen   { font-size: 7px; color: #94a3b8; text-align: right; white-space: nowrap; }
  .badges       { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

  /* ── Table: KEY FIX — auto layout so columns size to content ── */
  table {
    border-collapse: collapse;
    width: 100%;
    table-layout: auto;   /* ← CRITICAL: no more fixed-width truncation */
  }
  th, td {
    border: 1px solid #e2e8f0;
    padding: 3px 5px;
    vertical-align: middle;
    white-space: nowrap;  /* ← CRITICAL: no wrapping that causes "..." */
    overflow: visible;    /* ← CRITICAL: never clip content */
    text-overflow: clip;  /* ← CRITICAL: no ellipsis */
  }

  /* ── Header rows ── */
  .thead-dark th {
    background: #0f172a;
    color: #fff;
    font-size: 8px;
    letter-spacing: 0.3px;
    border-color: #334155;
  }
  .thead-blue th {
    background: #1e3a8a;
    color: #fff;
    font-size: 7.5px;
    border-color: #3b52a0;
  }
  .th-date { text-align: center; font-size: 7px; }

  /* ── Name cell: full name always visible ── */
  .td-name {
    font-weight: 700;
    font-size: 8.5px;
    min-width: 110px;    /* minimum, but can grow */
    max-width: 200px;    /* generous max */
    white-space: normal; /* allow wrap only for very long names */
    word-break: break-word;
  }
  .name-full { font-weight: 700; color: #111; }
  .name-id   { font-size: 6.5px; color: #94a3b8; font-family: monospace; margin-top: 1px; }

  /* ── Number / amount cells ── */
  .td-no    { text-align: center; font-size: 7px; color: #94a3b8; min-width: 20px; }
  .td-num   { text-align: right; font-size: 8px; }
  .td-bold  { font-weight: 800; }
  .td-center{ text-align: center; }
  .td-attr  { text-align: center; font-size: 7.5px; font-weight: 700; }

  /* ── Qty cells: full number, no truncation ── */
  .td-qty {
    text-align: center;
    font-family: monospace;
    font-size: 8px;
    min-width: 28px;     /* fits "99.9" comfortably */
  }

  /* ── Badges ── */
  .badge-named  { background:#eff6ff; color:#1d4ed8; padding:1px 4px; border-radius:3px; border:1px solid #bfdbfe; }
  .badge-seller { background:#f5f3ff; color:#7c3aed; padding:1px 4px; border-radius:3px; border:1px solid #ddd6fe; }

  /* ── Grand total row ── */
  .grand-total-row td {
    background: #1e293b;
    color: #fff;
    font-weight: 800;
    font-size: 8px;
    border-color: #475569;
    text-align: center;
  }

  /* ── Footer ── */
  .report-footer {
    margin-top: 14px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    font-size: 7px;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 8px;
  }
  .signatory {
    text-align: center;
  }
  .signatory-line {
    width: 140px;
    border-top: 1.5px solid #374151;
    margin-bottom: 4px;
  }
  .signatory-label { color: #374151; font-size: 8px; font-weight: 600; }

  @media print {
    @page { margin: 6mm; size: auto landscape; }
    body { padding: 0; }
  }
</style>
</head>
<body>

<div class="report-header">
  <div>
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:28px">💰</span>
      <div>
        <div class="report-title">Walk-in Payments Register</div>
        <div class="report-sub">${modeLabel} Report &nbsp;·&nbsp; ${filterLabel} &nbsp;·&nbsp; ${periodLabel}</div>
      </div>
    </div>
  </div>
  <div class="report-gen">Generated: ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
  <div class="badges">${summaryBadges}</div>
</div>

<table>
  <thead>
    <tr class="thead-dark">
      <th colspan="2" style="text-align:left">CUSTOMER</th>
      <th colspan="3" style="text-align:center">ATTRIBUTES</th>
      <th colspan="${D}" style="text-align:center;background:#1e3a8a">${monthLabel} — Daily Qty (Litres)</th>
      <th colspan="3" style="text-align:center;background:#1e40af">SALES SUMMARY</th>
      <th colspan="6" style="text-align:center;background:#064e3b;color:#6ee7b7">BILLING &amp; PAYMENT</th>
    </tr>
    <tr class="thead-blue">
      <th class="td-no">#</th>
      <th style="text-align:left">Customer Name</th>
      <th>Type</th>
      <th>Milk</th>
      <th>Shift</th>
      ${headerDateCols}
      <th style="text-align:right;background:#1e40af">Ltr</th>
      <th style="text-align:right">Rate</th>
      <th style="text-align:right;background:#1e40af">Amount</th>
      <th style="text-align:center;background:#065f46;color:#6ee7b7">Bill #</th>
      <th style="text-align:right;background:#7f1d1d;color:#fca5a5">Prev Bal</th>
      <th style="text-align:right;background:#065f46;color:#6ee7b7">Total Amt</th>
      <th style="text-align:right;background:#1e40af">Paid</th>
      <th style="text-align:center;background:#065f46;color:#6ee7b7">Rcpt Date</th>
      <th style="text-align:right;background:#78350f;color:#fde68a">Balance</th>
    </tr>
  </thead>
  <tbody>
    ${bodyRows}
    ${grandTotalRow}
  </tbody>
</table>

<div class="report-footer">
  <span>Walk-in Payments Register · Printed ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
  <div class="signatory">
    <div class="signatory-line"></div>
    <span class="signatory-label">Authorised Signatory</span>
  </div>
</div>

<script>window.onload = () => { window.print(); };</script>
</body>
</html>`);
        win.document.close();
    };

    // ── PDF: per-buyer statement ──────────────────────────────────
    const printBuyerStatement = (buyer) => {
        const key = buyerKey(buyer);
        const txs = transactionsMap[key] || [];

        const win = window.open("", "_blank", "width=900,height=900");
        if (!win) return;

        win.document.write(`<!DOCTYPE html>
        <html>
        <head>
            <title>${t("payments.statement")} - ${buyer.name}</title>
            <style>
                * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; color: #111; }
                table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
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
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md">
                            <Wallet size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">
                                {t("payments.walkin_payments")}
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t("payments.walkin_payments_subtitle")}
                            </p>
                        </div>
                    </div>

                   <div className="flex items-center gap-3 flex-wrap">
                        <button
                            onClick={startWalkinPaymentsTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                        >
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <button
                            onClick={() => { setBillSearchOpen(true); searchBills(""); }}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition"
                        >
                            <FileSearch size={13} /> Search Bills
                        </button>
                        <button
                            onClick={handleExportPDF}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition"
                        >
                            <Download size={14} />
                            {t("payments.export_pdf")}
                        </button>
                    </div>
                </div>

               {/* Date Range */}
                <div className="flex items-center gap-3 flex-wrap" data-tour="date-filters">
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            { v: "daily", l: t("payments.day") },
                            { v: "weekly", l: t("payments.week") },
                            { v: "monthly", l: t("payments.month") },
                        ].map(({ v, l }) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => handleDateRangeChange(v)}
                                className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        <Calendar size={12} className="text-gray-400" />
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
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
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
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                        />
                    </div>

                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            { v: "all", l: t("payments.all") },
                            { v: "cash", l: "💵 " + t("payments.cash") },
                            { v: "upi", l: "📱 " + t("payments.upi") },
                            { v: "credit", l: "💳 " + t("payments.credit") },
                        ].map(({ v, l }) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setFilterMode(v)}
                                className={`px-3 py-2 transition border-r last:border-r-0 border-gray-200
                                    ${filterMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Flash Message */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertTriangle size={15} />}
                        {flash.type === "success" && <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3" data-tour="payment-stats">
                    <StatCard
                        label={t("payments.total_received")}
                        value={fmt(summary.total_received)}
                        icon={<DollarSign size={14} />}
                        color="text-emerald-600 bg-emerald-50 border-emerald-100"
                    />
                    <StatCard
                        label={t("payments.cash")}
                        value={fmt(summary.cash_total)}
                        icon={<Banknote size={14} />}
                        color="text-emerald-600 bg-emerald-50 border-emerald-100"
                    />
                    <StatCard
                        label={t("payments.total_outstanding")}
                        value={fmt(totalOutstanding)}
                        sub={`${outstandingCount} ${outstandingCount !== 1 ? t("payments.buyers") : t("payments.buyer")}`}
                        icon={<Clock size={14} />}
                        color="text-rose-600 bg-rose-50 border-rose-100"
                    />
                </div>

                {/* Payment Entry Form */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6" data-tour="payment-form">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                            {t("payments.record_new_payment")}
                        </p>
                        <button
                            onClick={() => setShowRegisterBuyer(true)}
                            className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                        >
                            <Plus size={12} /> {t("payments.register_new_buyer")}
                        </button>
                    </div>

                    <div className="flex flex-wrap items-end gap-4">
                        {/* Buyer Selection */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
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
                                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                                />
                                {dropdownOpen && filteredBuyers.length > 0 && (
                                    <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-60 overflow-y-auto">
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
                                                className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition
                                                    ${highlightedIdx === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}
                                            >
                                                <div>
                                                    <p className="font-medium text-gray-800">{b.name}</p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {b.buyer_type === 'seller' ? '🧑‍🌾 ' + t("payments.seller") : '🏷️ ' + t("payments.named")}{b.mobile ? ` · ${b.mobile}` : ''}
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
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                <Calendar size={12} /> {t("payments.payment_date")}
                            </label>
                            <input
                                type="date"
                                value={paymentDate}
                                onChange={(e) => setPaymentDate(e.target.value)}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                            />
                        </div>

                        {/* Amount */}
                        <div className="w-36">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                <DollarSign size={12} /> {t("payments.amount")} (₹)
                            </label>
                            <input
                                type="number"
                                value={paymentForm.amount}
                                onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                            />
                        </div>

                        {/* Payment Mode */}
                        <div>
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                <CreditCard size={12} /> {t("payments.mode")}
                            </label>
                            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-semibold">
                                {PAYMENT_MODES.map(({ val, labelKey, icon, active }) => (
                                    <button
                                        key={val}
                                        type="button"
                                        onClick={() => setPaymentForm(p => ({ ...p, payment_mode: val }))}
                                        className={`flex items-center gap-1.5 px-3 py-2 transition-colors
                                            ${paymentForm.payment_mode === val ? active : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                    >
                                        {icon} {t(labelKey)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="flex-1 min-w-[150px]">
                            <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                                <FileText size={12} /> {t("payments.remarks")}
                            </label>
                            <input
                                type="text"
                                value={paymentForm.remarks}
                                onChange={(e) => setPaymentForm(p => ({ ...p, remarks: e.target.value }))}
                                placeholder={t("payments.optional_notes")}
                                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={savePayment}
                            disabled={saving || !selectedBuyer || !paymentForm.amount}
                            className="flex items-center gap-2 px-6 py-2 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                                bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <CheckCircle2 size={15} />
                            )}
                            {saving ? t("payments.saving") : t("payments.record_payment")}
                        </button>
                    </div>
                </div>

                {/* Search + Filter */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
                            placeholder={t("payments.search_buyers")}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>

                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            ["all", t("payments.all_types")],
                            ["named", "🏷️ " + t("payments.named")],
                            ["seller", "🧑‍🌾 " + t("payments.seller")],
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => { setFilterType(v); setCurrentPage(1); }}
                                className={`px-3 py-2 transition border-r last:border-r-0 border-gray-200
                                    ${filterType === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {l}
                            </button>
                        ))}
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

                    <span className="ml-auto text-xs text-gray-400">
                        {listFilteredBuyers.length} {listFilteredBuyers.length !== 1 ? t("payments.buyers") : t("payments.buyer")}
                    </span>
                </div>

              {/* Buyer Cards */}
                <div className="flex flex-col gap-3" data-tour="buyer-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : paginatedBuyers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Users size={32} />
                            <p className="text-sm">{t("payments.no_buyers_found")}</p>
                        </div>
                    ) : paginatedBuyers.map(buyer => {
                        const key = buyerKey(buyer);
                        const isOpen = expanded[key];
                        const hasOutstanding = buyer.outstanding_balance > 0.01;

                        return (
                            <div key={key}
                                className={`bg-white rounded-2xl border transition-all
                                    ${hasOutstanding ? "border-rose-200" : "border-gray-200"}`}>

                                {/* Row */}
                                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
                                    onClick={() => toggleExpand(buyer)}>

                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                        ${hasOutstanding ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}>
                                        {buyer.name?.charAt(0)?.toUpperCase()}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{buyer.name}</p>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                                ${buyer.buyer_type === 'seller'
                                                    ? "bg-violet-50 text-violet-600 border-violet-100"
                                                    : "bg-blue-50 text-blue-600 border-blue-100"}`}>
                                                {buyer.buyer_type === 'seller' ? '🧑‍🌾 ' + t("payments.seller") : '🏷️ ' + t("payments.named")}
                                            </span>
                                            {hasOutstanding ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 border border-rose-100">
                                                    <Clock size={9} /> {t("payments.outstanding")}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <CheckCircle2 size={9} /> {t("payments.cleared")}
                                                </span>
                                            )}
                                        </div>
                                        {buyer.mobile && <p className="text-[11px] text-gray-400 mt-0.5">{buyer.mobile}</p>}
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
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition shadow-sm shadow-rose-200">
                                            <Banknote size={11} /> {t("payments.clear_bill")}
                                        </button>
                                    )}

                                    {can('walkin_payments', 'W') && (
                                        <button
                                            onClick={(e) => handleSaveBill(e, buyer)}
                                            disabled={savingBill === buyerKey(buyer)}
                                            title={`Save bill for ${dateRange.from} → ${dateRange.to}`}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition shadow-sm disabled:opacity-50">
                                            {savingBill === buyerKey(buyer)
                                                ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                : <FileText size={11} />}
                                            Save Bill
                                        </button>
                                    )}

                                    <button
                                        onClick={(e) => { e.stopPropagation(); printBuyerStatement(buyer); }}
                                        className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition shadow-sm">
                                        <Download size={11} /> {t("payments.pdf")}
                                    </button>

                                    <div className="shrink-0 text-gray-300">
                                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {/* Mobile amounts */}
                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs flex-wrap">
                                    <span className="text-gray-400">{t("payments.total")}: <strong className="text-gray-700">{fmt(buyerTotalSalesMap[buyerKey(buyer)] ?? (parseFloat(buyer.total_paid || 0) + parseFloat(buyer.outstanding_balance || 0)))}</strong></span>
                                    <span className="text-emerald-500">{t("payments.paid")}: {fmt(buyer.total_paid)}</span>
                                    <span className={`font-bold ${hasOutstanding ? "text-rose-600" : "text-gray-900"}`}>
                                        {t("payments.bal")}: {fmt(buyer.outstanding_balance)}
                                    </span>
                                </div>

                                {/* Expanded: Payment history */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 px-4 py-4 flex flex-col gap-3">
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                            {t("payments.payment_history")}
                                        </p>

                                        {loadingTx[key] ? (
                                            <div className="flex justify-center py-6">
                                                <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                                            </div>
                                        ) : (transactionsMap[key] || []).length === 0 ? (
                                            <p className="text-xs text-gray-400 py-2">{t("payments.no_payments_recorded")}</p>
                                        ) : (
                                            <div className="rounded-xl border border-gray-100 overflow-hidden">

                                                {/* Desktop table header - hidden on mobile */}
                                                <div className="hidden sm:grid bg-gray-50 border-b border-gray-100"
                                                    style={{ gridTemplateColumns: "100px 100px 90px 1fr 80px" }}>
                                                    {[t("payments.date"), t("payments.amount"), t("payments.mode"), t("payments.remarks"), ""].map(h => (
                                                        <div key={h} className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{h}</div>
                                                    ))}
                                                </div>

                                                {(transactionsMap[key] || []).map(p => (
                                                    <div key={p.payment_id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition">

                                                        {/* Desktop row */}
                                                        <div className="hidden sm:grid"
                                                            style={{ gridTemplateColumns: "100px 100px 90px 1fr 80px" }}>
                                                            <div className="px-3 py-2 text-xs text-gray-600">{fmtDate(p.payment_date)}</div>
                                                            <div className="px-3 py-2 text-xs font-bold text-emerald-600">₹{parseFloat(p.amount).toFixed(2)}</div>
                                                            <div className="px-3 py-2"><PaymentBadge mode={p.payment_mode} /></div>
                                                            <div className="px-3 py-2 text-xs text-gray-500 truncate">{p.remarks || "—"}</div>
                                                            <div className="px-3 py-2 flex items-center">
                                                                <button
                                                                    onClick={() => undoPayment(buyer, p.payment_id)}
                                                                    disabled={undoingPayment === p.payment_id}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
                                            bg-rose-50 text-rose-600 border border-rose-100
                                            hover:bg-rose-100 disabled:opacity-40 transition"
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
                                                                    onClick={() => undoPayment(buyer, p.payment_id)}
                                                                    disabled={undoingPayment === p.payment_id}
                                                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold
                                            bg-rose-50 text-rose-600 border border-rose-100
                                            hover:bg-rose-100 disabled:opacity-40 transition shrink-0"
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

                {/* Pagination */}
                {listFilteredBuyers.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t("payments.prev")}
                            </button>
                            <span className="text-xs text-gray-600">
                                {t("payments.page")} {currentPage} {t("payments.of")} {totalPages || 1}
                            </span>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                                {t("payments.next")}
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t("payments.rows_per_page")}:</span>
                            <select
                                value={pageSize}
                                onChange={e => { setPageSize(parseInt(e.target.value)); setCurrentPage(1); }}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            >
                                {[5, 10, 25, 50].map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </main>

            {/* Register New Buyer Modal */}
            {showRegisterBuyer && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <User size={15} className="text-emerald-500" />
                                    {t("payments.register_new_buyer")}
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">{t("payments.add_new_named_buyer")}</p>
                            </div>
                            <button onClick={() => setShowRegisterBuyer(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("payments.full_name")} *</label>
                                <input
                                    type="text"
                                    value={newBuyerReg.name}
                                    onChange={e => setNewBuyerReg(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                                    placeholder={t("payments.enter_buyer_name")}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("payments.mobile_number")}</label>
                                <input
                                    type="tel"
                                    value={newBuyerReg.mobile}
                                    onChange={e => setNewBuyerReg(prev => ({ ...prev, mobile: e.target.value }))}
                                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                                    placeholder={t("payments.optional")}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("payments.address")}</label>
                                <textarea
                                    value={newBuyerReg.address}
                                    onChange={e => setNewBuyerReg(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                                    rows="2"
                                    placeholder={t("payments.optional")}
                                />
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowRegisterBuyer(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    {t("payments.cancel")}
                                </button>
                                <button onClick={registerBuyer} disabled={savingNewBuyer || !newBuyerReg.name.trim()}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-40 flex items-center justify-center gap-2">
                                    {savingNewBuyer && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {savingNewBuyer ? t("payments.registering") : t("payments.register_buyer")}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bill Search Modal */}
            {billSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-6xl h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                                    <FileSearch size={16} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">Bill Registry</h2>
                                    <p className="text-[10px] text-gray-400">Search and view all saved walkin bills</p>
                                </div>
                            </div>
                            <button onClick={() => { setBillSearchOpen(false); setBillDetail(null); setBillResults([]); setBillQuery(""); setBillListExpanded(true); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>

                        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap shrink-0 bg-gray-50/60">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                <input
                                    autoFocus
                                    value={billQuery}
                                    onChange={(e) => { setBillQuery(e.target.value); searchBills(e.target.value); setBillDetail(null); }}
                                    placeholder="Search by bill no, buyer name..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition placeholder:text-gray-300"
                                />
                                {billLoading && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                    </div>
                                )}
                            </div>
                            <button onClick={() => { setBillQuery(""); searchBills(""); setBillDetail(null); }}
                                className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 bg-white transition">
                                Show All
                            </button>
                            <span className="text-xs text-gray-400 font-medium">
                                {billResults.length > 0 ? `${billResults.length} ${billResults.length !== 1 ? "bills" : "bill"}` : ""}
                            </span>
                        </div>

                        <div className="flex flex-1 min-h-0 overflow-hidden relative">
                            {/* Left: Bills List */}
                            <div className={`flex flex-col overflow-hidden border-r border-gray-100 transition-all duration-300
                    ${!billListExpanded && billDetail ? "w-0 overflow-hidden" : billDetail ? "w-2/5" : "w-full"}`}
                                onClick={() => { if (billDetail) setBillDetail(null); }}>
                                <div className="grid px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0"
                                    style={{ gridTemplateColumns: "1fr 1fr 90px 80px 60px 60px" }}>
                                    <div>Bill No</div><div>Buyer</div><div>Period</div>
                                    <div className="text-right">Amount</div><div></div><div></div>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                                    {billLoading ? (
                                        <div className="flex items-center justify-center py-16">
                                            <div className="w-5 h-5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                        </div>
                                    ) : billResults.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                                            <FileText size={32} /><p className="text-xs">No bills found</p>
                                        </div>
                                    ) : billResults.map(b => {
                                        const isSelected = billDetail?.payment?.bill_no === b.bill_no;
                                        return (
                                            <button key={b.id || b.bill_no}
                                                onClick={(e) => { e.stopPropagation(); loadBillDetail(b.bill_no); }}
                                                className={`w-full text-left px-4 py-3 hover:bg-violet-50/60 transition grid items-center gap-2
                                        ${isSelected ? "bg-violet-50 border-l-2 border-l-violet-500" : "border-l-2 border-l-transparent"}`}
                                                style={{ gridTemplateColumns: "1fr 1fr 90px 80px 60px 60px" }}>
                                                <div>
                                                    <span className="text-xs font-mono font-bold text-violet-700">{b.bill_no}</span>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        Paid: {new Date(b.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                    </p>
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-gray-800 truncate">{b.buyer_name || b.name}</p>
                                                    <p className="text-[10px] font-mono text-gray-400 capitalize">{b.buyer_type}</p>
                                                </div>
                                                <div className="text-[10px] text-gray-500">
                                                    {new Date(b.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                    {" → "}
                                                    {new Date(b.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs font-bold text-emerald-600">
                                                        ₹{parseFloat(b.amount_paid || b.cash_paid || 0).toFixed(0)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const { data } = await api.get(`/walkin-payments/bill/${b.bill_no}`);
                                                            printWalkinBillReceipt(data);
                                                        } catch { showFlash("error", "Failed to load bill for print."); }
                                                    }}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-semibold hover:bg-gray-700 transition">
                                                        <Printer size={9} /> PDF
                                                    </button>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteBill(b.bill_no); }}
                                                        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700 transition">
                                                        <Trash2 size={9} /> Del
                                                    </button>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Right: Bill Detail Pane */}
                            {billDetail && (
                                <div className="flex-1 overflow-y-auto flex flex-col relative">
                                    <button onClick={() => setBillListExpanded(p => !p)}
                                        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-5 h-12 bg-violet-600 hover:bg-violet-700 text-white rounded-r-lg shadow-md transition">
                                        {billListExpanded ? <ChevronDown size={11} className="-rotate-90" /> : <ChevronDown size={11} className="rotate-90" />}
                                    </button>
                                    {billDetailLoading ? (
                                        <div className="flex items-center justify-center flex-1">
                                            <div className="w-5 h-5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" />
                                        </div>
                                    ) : (
                                        <>
                                            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-violet-50">
                                                <button onClick={() => setBillDetail(null)}
                                                    className="absolute right-4 top-4 w-7 h-7 flex items-center justify-center rounded-full bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 transition">
                                                    <X size={13} />
                                                </button>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-mono font-bold text-violet-700">{billDetail.payment.bill_no}</span>
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Paid</span>
                                                    </div>
                                                    <p className="text-base font-bold text-gray-900 mt-0.5">{billDetail.payment.buyer_name || billDetail.payment.name}</p>
                                                    <p className="text-[11px] text-gray-500 mt-0.5 capitalize">
                                                        {billDetail.payment.buyer_type}
                                                        {" · "}
                                                        {new Date(billDetail.payment.from_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                        {" → "}
                                                        {new Date(billDetail.payment.to_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                                                    </p>
                                                </div>
                                                <button onClick={() => printWalkinBillReceipt(billDetail)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-700 transition">
                                                    <Printer size={13} /> Print Full PDF
                                                </button>
                                            </div>

                                            <div className="px-6 py-4 flex flex-col gap-5">
                                                {/* Summary Cards */}
                                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                                    {[
                                                        { label: "Total Sales", value: `₹${parseFloat(billDetail.payment.total_sales_amount || billDetail.payment.milk_amount || 0).toFixed(2)}`, color: "bg-emerald-50 border-emerald-100 text-emerald-700" },
                                                        { label: "Entries", value: `${(billDetail.entries || []).length} entries`, color: "bg-blue-50 border-blue-100 text-blue-700" },
                                                        { label: "Amount Paid", value: `₹${parseFloat(billDetail.payment.amount_paid || 0).toFixed(2)}`, color: "bg-amber-50 border-amber-100 text-amber-700" },
                                                        { label: "Remaining Balance", value: `₹${parseFloat(billDetail.payment.remaining_balance || billDetail.payment.outstanding || 0).toFixed(2)}`, color: "bg-gray-900 border-gray-900 text-white" },
                                                    ].map(({ label, value, color }) => (
                                                        <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
                                                            <p className="text-[10px] opacity-70 uppercase tracking-wider">{label}</p>
                                                            <p className="text-sm font-bold mt-0.5">{value}</p>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Entries Table */}
                                                {(billDetail.entries || []).length > 0 && (
                                                    <div>
                                                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                            Sales Entries ({billDetail.entries.length})
                                                        </p>
                                                        <div className="rounded-xl border border-gray-100 overflow-hidden text-xs">
                                                            <div className="grid bg-gray-900 text-white"
                                                                style={{ gridTemplateColumns: "85px 80px 70px 60px 60px 70px" }}>
                                                                {["Date", "Milk Type", "Shift", "Qty (L)", "Rate", "Amount"].map(h => (
                                                                    <div key={h} className="px-3 py-2 text-[10px] font-semibold uppercase">{h}</div>
                                                                ))}
                                                            </div>
                                                            {billDetail.entries.map((e, i) => (
                                                                <div key={i}
                                                                    className={`grid border-b border-gray-50 last:border-0 hover:bg-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                                                                    style={{ gridTemplateColumns: "85px 80px 70px 60px 60px 70px" }}>
                                                                    <div className="px-3 py-2 text-gray-600">
                                                                        {new Date(e.sale_date || e.entry_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                                                    </div>
                                                                    <div className="px-3 py-2">
                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize
                                                                ${e.milk_type === "cow" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                                                            {e.milk_type}
                                                                        </span>
                                                                    </div>
                                                                    <div className="px-3 py-2">
                                                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full
                                                                ${e.shift === "morning" ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-600"}`}>
                                                                            {e.shift === "morning" ? "☀ M" : "🌙 E"}
                                                                        </span>
                                                                    </div>
                                                                    <div className="px-3 py-2 text-blue-600 font-mono font-semibold">{parseFloat(e.quantity || 0).toFixed(2)}</div>
                                                                    <div className="px-3 py-2 text-gray-600 font-mono">₹{parseFloat(e.mrp || e.rate_applied || 0).toFixed(2)}</div>
                                                                    <div className="px-3 py-2 font-bold text-gray-800">₹{parseFloat(e.total_amount || 0).toFixed(2)}</div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Payment Breakdown */}
                                                <div>
                                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Breakdown</p>
                                                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                        {[
                                                            { label: "Total Sales Amount", value: parseFloat(billDetail.payment.total_sales_amount || billDetail.payment.milk_amount || 0), type: "credit", color: "bg-emerald-50 text-emerald-700" },
                                                            { label: "Amount Paid This Cycle", value: parseFloat(billDetail.payment.amount_paid || 0), type: "debit", color: "bg-blue-50 text-blue-700" },
                                                        ].filter(r => r.value > 0).map((row, i) => (
                                                            <div key={i} className={`flex items-center justify-between px-4 py-3 border-b border-gray-100 last:border-0 ${row.color}`}>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
                                                            ${row.type === "credit" ? "bg-emerald-200 text-emerald-800" : "bg-rose-200 text-rose-800"}`}>
                                                                        {row.type === "credit" ? "+" : "−"}
                                                                    </span>
                                                                    <span className="text-xs font-medium">{row.label}</span>
                                                                </div>
                                                                <span className="text-xs font-bold font-mono">
                                                                    {row.type === "debit" ? "− " : "+ "}₹{row.value.toFixed(2)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                        <div className="flex items-center justify-between px-4 py-4 bg-gray-900 text-white">
                                                            <span className="text-sm font-bold uppercase tracking-wider">Remaining Balance</span>
                                                            <span className="text-lg font-bold font-mono">
                                                                ₹{parseFloat(billDetail.payment.remaining_balance || billDetail.payment.outstanding || 0).toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-2 border-t border-gray-100">
                                                    <span>Bill No: <strong className="text-gray-600">{billDetail.payment.bill_no}</strong> · Computer Generated</span>
                                                    <span>Paid on: {new Date(billDetail.payment.paid_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Bill Confirm Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">Delete Bill</h2>
                                    <p className="text-[10px] text-gray-400">This action cannot be undone</p>
                                </div>
                            </div>
                            <button onClick={cancelDeleteBill} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-3">
                            <p className="text-sm text-gray-600">
                                Are you sure you want to delete bill <strong className="font-mono text-rose-700">{deletingBill}</strong>?
                            </p>
                            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs text-rose-700">
                                <p className="font-semibold mb-1">The following will be reversed:</p>
                                <ul className="list-disc list-inside text-rose-600 space-y-0.5">
                                    <li>Payment record and bill entry</li>
                                    <li>Buyer outstanding balance adjustment</li>
                                    <li>Buyer payment status reset</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={cancelDeleteBill} className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                Cancel
                            </button>
                            <button onClick={confirmDeleteBill} disabled={deleting}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50">
                                {deleting ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={12} />}
                                {deleting ? "Deleting..." : "Yes, Delete Bill"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Clear Bill Modal */}
            {showClearBillModal && clearBillBuyer && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Banknote size={15} className="text-rose-500" />
                                    {t("payments.clear_bill")}
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">{clearBillBuyer.name}</p>
                            </div>
                            <button onClick={() => setShowClearBillModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="p-3 bg-gray-50 rounded-xl">
                                <p className="text-sm text-gray-600">{t("payments.outstanding_balance")}</p>
                                <p className="text-2xl font-bold text-rose-600">₹{clearBillBuyer.outstanding_balance.toFixed(2)}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t("payments.amount_paid")}</label>
                                <input
                                    type="number"
                                    value={clearBillAmount}
                                    onChange={e => setClearBillAmount(e.target.value)}
                                    step="0.01"
                                    min="0"
                                    max={clearBillBuyer.outstanding_balance}
                                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
                                />
                            </div>
                            {clearBillAmount && parseFloat(clearBillAmount) < clearBillBuyer.outstanding_balance && (
                                <p className="text-xs text-amber-600">
                                    ₹{(clearBillBuyer.outstanding_balance - parseFloat(clearBillAmount)).toFixed(2)} {t("payments.will_remain_as_balance")}
                                </p>
                            )}
                            <div className="flex gap-2 pt-2">
                                <button onClick={() => setShowClearBillModal(false)} className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    {t("payments.cancel")}
                                </button>
                                <button onClick={clearBuyerBill} disabled={clearingBill || !clearBillAmount || parseFloat(clearBillAmount) <= 0}
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