import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
    ShoppingBag, Package, Users, Banknote, TrendingUp,
    ChevronDown, ChevronUp, CheckCircle2, Clock,
    RefreshCw, Printer, BadgeCheck, AlertTriangle,
    X, Search, Calendar, Download, FileSearch, Hash,
    FileText, Trash2
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';
import { useAppConfig } from '../../context/AppConfigContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

const computeCycles = (seedFrom, daysPerCycle, count = 50) => {
    const cycles = [];
    const seed = new Date(seedFrom + 'T00:00:00');
    for (let i = 0; i < count; i++) {
        const start = new Date(seed);
        start.setDate(start.getDate() + i * daysPerCycle);
        const end = new Date(start);
        end.setDate(end.getDate() + daysPerCycle - 1);
        cycles.push({ from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] });
    }
    return cycles;
};

const getActiveCycle = (seedFrom, daysPerCycle) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cycles = computeCycles(seedFrom, daysPerCycle, 200);
    return cycles.find(c => {
        const s = new Date(c.from + 'T00:00:00');
        const e = new Date(c.to + 'T00:00:00');
        return today >= s && today <= e;
    }) || null;
};

// Get first and last day of current month
const getCurrentMonthRange = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        from: first.toISOString().split('T')[0],
        to: last.toISOString().split('T')[0],
        label: "Month"
    };
};

// Fixed monthly cycles including "Month"
const getFixedMonthCycles = (refDate) => {
    const y = refDate.getFullYear();
    const m = refDate.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const ymd = (yr, mo, day) => `${yr}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const monthRange = getCurrentMonthRange();
    return [
        { label: "1–10", from: ymd(y, m, 1), to: ymd(y, m, 10) },
        { label: "11–20", from: ymd(y, m, 11), to: ymd(y, m, 20) },
        { label: `21–${lastDay}`, from: ymd(y, m, 21), to: ymd(y, m, lastDay) },
        { label: "Month", from: monthRange.from, to: monthRange.to },
    ];
};

// Returns the cycle that contains today, preferring "Month" if today falls in it (always true)
const getActiveFixedCycle = (refDate = new Date()) => {
    const cycles = getFixedMonthCycles(refDate);
    const today = new Date(refDate);
    today.setHours(0, 0, 0, 0);
    // Try to find the matching split first
    const found = cycles.find(c => {
        const s = new Date(c.from + 'T00:00:00');
        const e = new Date(c.to + 'T00:00:00');
        return today >= s && today <= e;
    });
    // If found, return its index; otherwise default to "Month" (index 3)
    if (found) {
        return cycles.indexOf(found);
    }
    return 3; // Month
};

// ── StatCard ──────────────────────────────────────────────────
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

// ── CycleConfigModal (reused) ──────────────────────────────
function CycleConfigModal({ open, onClose, onSave, initialSeed, initialDays, computeCycles }) {
    const { t } = useTranslation();
    const [localSeed, setLocalSeed] = useState(initialSeed);
    const [localDays, setLocalDays] = useState(initialDays);
    if (!open) return null;
    const previewCycles = computeCycles(localSeed, Math.max(1, localDays), 6);
    const handleSave = () => onSave(localSeed, Math.max(1, localDays));
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center">
                            <BadgeCheck size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">{t('productPurchasePayments.configureCycle')}</h2>
                            <p className="text-[10px] text-gray-400">{t('productPurchasePayments.cycleConfigDesc')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                        <X size={15} />
                    </button>
                </div>
                <div className="px-6 py-5 flex flex-col gap-4">
                    <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                        <AlertTriangle size={14} className="text-blue-500 mt-0.5 shrink-0" />
                        <p className="text-xs text-blue-700 leading-relaxed"
                            dangerouslySetInnerHTML={{
                                __html: t('productPurchasePayments.cycleInfo', {
                                    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                                })
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.seedStartDate')}</label>
                            <input type="date" value={localSeed} onChange={e => setLocalSeed(e.target.value)}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.daysPerCycle')}</label>
                            <input type="number" min={1} max={31} value={localDays}
                                onChange={e => setLocalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('productPurchasePayments.upcomingCycles')}</p>
                        <div className="flex flex-col gap-1.5">
                            {previewCycles.map((c, i) => {
                                const today = new Date(); today.setHours(0, 0, 0, 0);
                                const s = new Date(c.from + 'T00:00:00');
                                const e = new Date(c.to + 'T00:00:00');
                                const isCurrent = today >= s && today <= e;
                                const isPayDay = today.getTime() === e.getTime();
                                const isPast = e < today;
                                return (
                                    <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs ${isCurrent ? 'border-violet-200 bg-violet-50' : 'border-gray-100 bg-gray-50'}`}>
                                        <span className="text-[10px] text-gray-400 font-medium min-w-[52px]">Cycle {i + 1}</span>
                                        <span className="flex-1 font-medium text-gray-700">
                                            {s.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} → {e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                            {isCurrent && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-200 text-violet-700 font-semibold">current</span>}
                                        </span>
                                        {isPayDay
                                            ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Payment day — today!</span>
                                            : isCurrent ? <span className="text-[10px] text-violet-500">{t('productPurchasePayments.payOn', { date: e.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) })}</span>
                                                : isPast ? <span className="text-[10px] text-gray-400">{t('productPurchasePayments.past')}</span>
                                                    : <span className="text-[10px] text-gray-400">{t('productPurchasePayments.upcoming')}</span>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">{t('productPurchasePayments.cancel')}</button>
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition">
                        <BadgeCheck size={12} />{t('productPurchasePayments.saveCycleConfig')}</button>
                </div>
            </div>
        </div>
    );
}

// ── Main Component ────────────────────────────────────────────
export default function PurchasedProductsBillPayment() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const { appName } = useAppConfig();
    const { can, loading: permLoading } = usePermission();

    const [customFrom, setCustomFrom] = useState(null);
    const [customTo, setCustomTo] = useState(null);

    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState({});
    const [paying, setPaying] = useState(null);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [filterPaid, setFilterPaid] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(5);
    const [cycleConfigOpen, setCycleConfigOpen] = useState(false);
    const [cycleSeedFrom, setCycleSeedFrom] = useState(new Date().toISOString().split('T')[0]);
    const [cycleDaysPerCycle, setCycleDaysPerCycle] = useState(10);
    const [cycleConfigLoaded, setCycleConfigLoaded] = useState(false);
    const [useCustomCycle, setUseCustomCycle] = useState(false);
    const fixedCycles = getFixedMonthCycles(new Date());
    // Default to "Month" index (3) if available, else 0
    const [activeFixedIdx, setActiveFixedIdx] = useState(() => {
        const idx = getActiveFixedCycle();
        return idx !== undefined ? idx : 3;
    });

    const [simulatedToday, setSimulatedToday] = useState(() => new Date().toISOString().split('T')[0]);

    // Bill search modal
    const [billSearchOpen, setBillSearchOpen] = useState(false);
    const [billQuery, setBillQuery] = useState("");
    const [billResults, setBillResults] = useState([]);
    const [billDetail, setBillDetail] = useState(null);
    const [billLoading, setBillLoading] = useState(false);
    const [billDetailLoading, setBillDetailLoading] = useState(false);
    const [deletingBill, setDeletingBill] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Bulk download
    const [bulkDownloading, setBulkDownloading] = useState(false);
    const [combinedDownloading, setCombinedDownloading] = useState(false);

    // ── Fetch cycle config ──────────────────────────────────────
    useEffect(() => {
        const fetchCycleConfig = async () => {
            try {
                const { data } = await api.get('/product-purchase-payments/cycle-config');
                if (data) {
                    const seed = data.seed_from.split('T')[0];
                    const days = data.days_per_cycle;
                    setCycleSeedFrom(seed);
                    setCycleDaysPerCycle(days);
                }
            } catch (err) {
                console.error("Failed to fetch product purchase cycle config:", err);
            } finally {
                // Set default to current month
                const monthRange = getCurrentMonthRange();
                setCustomFrom(monthRange.from);
                setCustomTo(monthRange.to);
                // If we have fixed cycles, set active to "Month" (index 3)
                const cycles = getFixedMonthCycles(new Date());
                const monthIdx = cycles.findIndex(c => c.label === "Month");
                if (monthIdx !== -1) setActiveFixedIdx(monthIdx);
                setCycleConfigLoaded(true);
            }
        };
        fetchCycleConfig();
    }, []);

    useEffect(() => {
        if (!useCustomCycle) return;
        const active = getActiveCycle(cycleSeedFrom, cycleDaysPerCycle);
        if (active) {
            setCustomFrom(active.from);
            setCustomTo(active.to);
        }
    }, [cycleSeedFrom, cycleDaysPerCycle, useCustomCycle]);

    const handleCycleModeToggle = (toCustom) => {
        setUseCustomCycle(toCustom);
        if (toCustom) {
            const active = getActiveCycle(cycleSeedFrom, cycleDaysPerCycle);
            if (active) { setCustomFrom(active.from); setCustomTo(active.to); }
        } else {
            selectFixedCycle(activeFixedIdx);
        }
    };

    const selectFixedCycle = (idx) => {
        const cycles = getFixedMonthCycles(new Date());
        const c = cycles[idx];
        if (!c) return;
        setActiveFixedIdx(idx);
        setCustomFrom(c.from);
        setCustomTo(c.to);
    };

    // ── Fetch suppliers summary ──────────────────────────────
    const fetchSuppliers = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(
                `/product-purchase-payments/summary?from=${customFrom}&to=${customTo}`
            );
            setSuppliers(data);
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('productPurchasePayments.loadError'));
        } finally {
            setLoading(false);
        }
    }, [customFrom, customTo, t]);

    useEffect(() => {
        if (!cycleConfigLoaded) return;
        fetchSuppliers();
    }, [fetchSuppliers, cycleConfigLoaded]);

    // ── Payment day check ──────────────────────────────────────
    const isTodayPaymentDay = (cycleFrom, cycleTo) => {
        const today = new Date(simulatedToday + 'T00:00:00');
        today.setHours(0, 0, 0, 0);
        const end = new Date(cycleTo + 'T00:00:00');
        return today.getTime() === end.getTime();
    };

    // ── Flash messages ──────────────────────────────────────────
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Mark paid ──────────────────────────────────────────────
    const handleMarkPaid = async (supplier) => {
        if (paying) return;
        setPaying(supplier.supplier_name);
        try {
            const { data } = await api.post("/product-purchase-payments/mark-paid", {
                supplier_name: supplier.supplier_name,
                from_date: customFrom,
                to_date: customTo,
            });
            showFlash("success", t('productPurchasePayments.paidSuccess', { billNo: data.bill_no }));
            await fetchSuppliers();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('productPurchasePayments.paidError'));
        } finally {
            setPaying(null);
        }
    };

    // ── Undo payment ────────────────────────────────────────────
    const handleUndo = async (e, supplier) => {
        e.stopPropagation();
        if (!supplier.bill_no) return;
        try {
            await api.delete(`/product-purchase-payments/bill/${supplier.bill_no}`);
            showFlash("success", t('productPurchasePayments.undoSuccess', { name: supplier.supplier_name, billNo: supplier.bill_no }));
            await fetchSuppliers();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('productPurchasePayments.undoError'));
        }
    };

    // ── PDF Generation ──────────────────────────────────────────
    const generateReceiptPDF = async (htmlContent, fileName) => {
        try {
            const container = document.createElement('div');
            container.innerHTML = htmlContent;
            container.style.position = 'fixed';
            container.style.left = '-9999px';
            container.style.top = '0';
            container.style.width = '794px';
            container.style.background = 'white';
            container.style.padding = '20px';
            container.style.zIndex = '-9999';
            container.style.fontSize = '11px';
            container.style.fontFamily = 'Arial, sans-serif';
            container.style.color = '#000000';
            document.body.appendChild(container);
            await new Promise(resolve => setTimeout(resolve, 800));
            const canvas = await html2canvas(container, {
                scale: 2.5,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
                width: 794,
                height: container.scrollHeight,
            });
            document.body.removeChild(container);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
            pdf.save(fileName);
            return true;
        } catch (error) {
            console.error('PDF generation error:', error);
            return false;
        }
    };

    // Build receipt HTML for product purchases
    const buildReceiptHtml = async (supplier) => {
        let billData = null;
        if (supplier.bill_no) {
            try {
                const { data } = await api.get(`/product-purchase-payments/bill/${supplier.bill_no}`);
                billData = data;
            } catch { /* ignore */ }
        }

        const entries = billData?.items || supplier.entries || [];

        const totalQty = entries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const totalAmount = parseFloat(supplier.total_amount || 0);
        const billNo = supplier.bill_no || 'DRAFT';

        const fmtR = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

        const rows = entries.map((e, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                <td style="padding:4px 6px;border:1px solid #ccc;font-size:10px;text-align:left">${e.product_name || 'Unknown'}</td>
                <td style="padding:4px 6px;border:1px solid #ccc;font-size:10px;text-align:center">${e.unit || '—'}</td>
                <td style="padding:4px 6px;border:1px solid #ccc;font-size:10px;text-align:right">${parseFloat(e.quantity || 0).toFixed(2)}</td>
                <td style="padding:4px 6px;border:1px solid #ccc;font-size:10px;text-align:right">${fmtR(e.rate)}</td>
                <td style="padding:4px 6px;border:1px solid #ccc;font-size:10px;text-align:right">${e.mrp_rate ? fmtR(e.mrp_rate) : '—'}</td>
                <td style="padding:4px 6px;border:1px solid #ccc;font-size:10px;text-align:right;font-weight:bold">${fmtR(e.total_amount)}</td>
            </tr>
        `).join('');

        const fromDate = customFrom || 'draft';
        const toDate = customTo || 'draft';

        return `<!DOCTYPE html>
<html>
<head><title>Product Purchase Receipt - ${supplier.supplier_name}</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #000; margin: 0; padding: 16px; background: #fff; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #000; padding: 4px 6px; text-align: center; font-size: 10px; }
    th { background: #e0e0e0; font-weight: bold; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 6px; background: #f0f0f0; padding: 10px; border-radius: 4px; margin-bottom: 10px; border: 1px solid #000; }
    .info-item .lbl { font-size: 9px; color: #333; text-transform: uppercase; }
    .info-item .val { font-size: 12px; font-weight: bold; margin-top: 1px; }
    .summary { display: flex; justify-content: space-between; background: #f8f8f8; padding: 8px 12px; border: 1px solid #000; border-radius: 4px; margin: 10px 0; }
    .summary .lbl { font-weight: bold; }
    .summary .val { font-size: 14px; font-weight: bold; }
    .footer { display: flex; justify-content: space-between; font-size: 9px; color: #666; border-top: 1px solid #eee; padding-top: 8px; margin-top: 10px; }
</style>
</head>
<body>

<div class="header">
    <div>
        <h1 style="margin:0;font-size:16px;">${appName}</h1>
        <div style="font-size:10px;color:#333;">Product Purchase Payment Receipt</div>
    </div>
    <div style="text-align:right;font-size:10px;">
        <div><strong>Bill No:</strong> ${billNo}</div>
        <div>Period: ${fmtD(fromDate)} – ${fmtD(toDate)}</div>
        <div>Generated: ${fmtD(new Date().toISOString())}</div>
    </div>
</div>

<div class="info-grid">
    <div class="info-item"><div class="lbl">Supplier</div><div class="val">${supplier.supplier_name}</div></div>
    <div class="info-item"><div class="lbl">Total Purchases</div><div class="val">${entries.length}</div></div>
    <div class="info-item"><div class="lbl">Status</div><div class="val" style="color:#16a34a;">${supplier.is_paid ? 'Paid' : 'Pending'}</div></div>
</div>

${entries.length > 0 ? `
<table>
    <thead>
        <tr>
            <th style="text-align:left">Product</th>
            <th>Unit</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">MRP</th>
            <th style="text-align:right">Amount</th>
        </tr>
    </thead>
    <tbody>
        ${rows}
        <tr style="background:#e0e0e0;font-weight:bold;">
            <td colspan="5" style="text-align:right;border:1px solid #000;">Total</td>
            <td style="text-align:right;border:1px solid #000;">${fmtR(totalAmount)}</td>
        </tr>
    </tbody>
</table>
` : `<p style="text-align:center;color:#999;">No purchase items found.</p>`}

<div class="summary">
    <span class="lbl">Total Amount Payable</span>
    <span class="val">${fmtR(totalAmount)}</span>
</div>

<div class="footer">
    <span>Computer Generated · ${appName}</span>
    <span>${supplier.is_paid ? `Paid on: ${fmtD(supplier.paid_at)}` : ''}</span>
</div>

</body></html>`;
    };

    // Download single PDF
    const downloadReceiptPDF = async (supplier) => {
        try {
            const html = await buildReceiptHtml(supplier);
            if (!html) {
                showFlash("error", t('productPurchasePayments.receiptGenerationError'));
                return false;
            }
            const fileName = `ProductPurchaseBill_${supplier.supplier_name.replace(/\s/g, '_')}_${supplier.bill_no || 'draft'}.pdf`;
            const success = await generateReceiptPDF(html, fileName);
            if (success) return true;
            else {
                showFlash("error", t('productPurchasePayments.pdfGenerationError'));
                return false;
            }
        } catch (error) {
            console.error('Error generating PDF:', error);
            showFlash("error", t('productPurchasePayments.pdfGenerationError'));
            return false;
        }
    };

    // Print receipt (opens new window)
    const printReceipt = async (e, supplier) => {
        e.stopPropagation();
        const html = await buildReceiptHtml(supplier);
        if (!html) {
            showFlash("error", t('productPurchasePayments.printLoadError'));
            return;
        }
        const win = window.open("", "_blank", "width=900,height=900");
        if (!win) {
            showFlash("error", t('productPurchasePayments.popupBlocked'));
            return;
        }
        win.document.write(html);
        win.document.close();
        win.onload = () => { win.print(); };
    };

    // Bulk download all PDFs
    const handleBulkDownloadPDFs = async () => {
        const paidSuppliers = suppliers.filter(s => s.is_paid && parseFloat(s.total_amount || 0) > 0);
        if (paidSuppliers.length === 0) {
            showFlash("error", t('productPurchasePayments.noPaidSuppliersToDownload') || "No paid suppliers to download.");
            return;
        }
        setBulkDownloading(true);
        let successCount = 0;
        try {
            showFlash("info", `Preparing ${paidSuppliers.length} PDF receipts...`);
            for (let i = 0; i < paidSuppliers.length; i++) {
                const s = paidSuppliers[i];
                if (i % 5 === 0 && i > 0) {
                    showFlash("info", `Downloading ${i + 1}/${paidSuppliers.length} receipts...`);
                }
                const success = await downloadReceiptPDF(s);
                if (success) successCount++;
                await new Promise(r => setTimeout(r, 600));
            }
            showFlash("success", t('productPurchasePayments.bulkDownloadSuccess', { count: successCount }) || `Downloaded ${successCount} receipt(s).`);
        } catch (err) {
            showFlash("error", t('productPurchasePayments.bulkDownloadError'));
        } finally {
            setBulkDownloading(false);
        }
    };

    // Combined PDF
    const handleCombinedDownload = async () => {
        const paidSuppliers = suppliers.filter(s => s.is_paid && parseFloat(s.total_amount || 0) > 0);
        if (paidSuppliers.length === 0) {
            showFlash("error", t('productPurchasePayments.noPaidSuppliersToDownload'));
            return;
        }
        if (paidSuppliers.length > 20 && !window.confirm(`This will combine ${paidSuppliers.length} receipts into one PDF. Continue?`)) return;
        setCombinedDownloading(true);
        try {
            showFlash("info", `Generating combined PDF with ${paidSuppliers.length} receipts...`);
            const pdf = new jsPDF('p', 'mm', 'a4');
            let firstPage = true;
            let successCount = 0;
            for (const s of paidSuppliers) {
                const html = await buildReceiptHtml(s);
                if (!html) continue;
                const container = document.createElement('div');
                container.innerHTML = html;
                container.style.position = 'fixed';
                container.style.left = '-9999px';
                container.style.top = '0';
                container.style.width = '794px';
                container.style.background = 'white';
                container.style.padding = '20px';
                container.style.zIndex = '-9999';
                document.body.appendChild(container);
                await new Promise(r => setTimeout(r, 800));
                const canvas = await html2canvas(container, {
                    scale: 2.5,
                    useCORS: true,
                    logging: false,
                    backgroundColor: '#ffffff',
                    width: 794,
                    height: container.scrollHeight,
                });
                document.body.removeChild(container);
                const imgWidth = 190;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                if (!firstPage) pdf.addPage();
                firstPage = false;
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                pdf.addImage(imgData, 'JPEG', 10, 10, imgWidth, imgHeight);
                successCount++;
            }
            const fileName = `Combined_ProductPurchase_Bills_${customFrom}_to_${customTo}.pdf`;
            pdf.save(fileName);
            showFlash("success", `Combined PDF generated with ${successCount} receipts.`);
        } catch (err) {
            showFlash("error", "Failed to generate combined PDF.");
        } finally {
            setCombinedDownloading(false);
        }
    };

    // ── Bill Search ──────────────────────────────────────────────
    const searchBills = async (q) => {
        setBillLoading(true);
        try {
            const url = q.trim()
                ? `/product-purchase-payments/bills/search?q=${encodeURIComponent(q)}`
                : `/product-purchase-payments/bills/search`;
            const { data } = await api.get(url);
            setBillResults(data);
        } catch { setBillResults([]); }
        finally { setBillLoading(false); }
    };

    const loadBillDetail = async (bill_no) => {
        setBillDetailLoading(true);
        setBillDetail(null);
        try {
            const { data } = await api.get(`/product-purchase-payments/bill/${bill_no}`);
            setBillDetail(data);
        } catch { showFlash("error", t('productPurchasePayments.billNotFound')); }
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
            await api.delete(`/product-purchase-payments/bill/${deletingBill}`);
            showFlash("success", t('productPurchasePayments.deleteSuccess', { billNo: deletingBill }));
            setBillResults(prev => prev.filter(b => b.bill_no !== deletingBill));
            if (billDetail?.bill?.bill_no === deletingBill) setBillDetail(null);
            await fetchSuppliers();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('productPurchasePayments.deleteError'));
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

    // ── Print Register ──────────────────────────────────────────
    const printRegister = () => {
        const active = suppliers.filter(s => parseFloat(s.total_amount || 0) > 0);
        if (active.length === 0) {
            showFlash("error", "No suppliers to print.");
            return;
        }
        const fmtR = (n) => parseFloat(n || 0).toFixed(2);
        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "-";

        const rows = active.map((s, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
                <td style="padding:4px 6px;border:1px solid #999;font-size:10px;text-align:left">${s.supplier_name}</td>
                <td style="padding:4px 6px;border:1px solid #999;font-size:10px;text-align:right">${s.entries ? s.entries.length : '—'}</td>
                <td style="padding:4px 6px;border:1px solid #999;font-size:10px;text-align:right;font-weight:bold">${fmtR(s.total_amount)}</td>
                <td style="padding:4px 6px;border:1px solid #999;font-size:10px;text-align:center">
                    ${s.is_paid ? `<span style="color:#16a34a;">Paid</span> (${s.bill_no})` : 'Pending'}
                </td>
                <td style="padding:4px 6px;border:1px solid #999;font-size:10px;text-align:center">${s.is_paid ? fmtD(s.paid_at) : '—'}</td>
            </tr>
        `).join('');

        const totalAmount = active.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
        const paidCount = active.filter(s => s.is_paid).length;

        const win = window.open("", "_blank", "width=1100,height=900");
        if (!win) { showFlash("error", t('productPurchasePayments.popupBlocked')); return; }

        win.document.write(`<!DOCTYPE html>
<html>
<head><title>Product Purchase Payment Register</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 10px; color: #000; margin: 0; padding: 16px; background: #fff; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #999; padding: 4px 6px; text-align: center; }
    th { background: #e0e0e0; font-weight: bold; }
    .header { text-align:center; margin-bottom:12px; }
    .header h1 { margin:0; font-size:18px; }
    .totals { display:flex; justify-content:space-between; margin:10px 0; font-weight:bold; }
    @media print { @page { margin: 8mm; } body { padding: 0; } }
</style>
</head>
<body>
<div class="header">
    <h1>${appName}</h1>
    <div style="font-size:11px;color:#333;">Product Purchase Payment Register</div>
    <div style="font-size:10px;color:#555;">Period: ${fmtD(customFrom)} – ${fmtD(customTo)}</div>
</div>
<table>
    <thead>
        <tr>
            <th style="text-align:left">Supplier</th>
            <th># Purchases</th>
            <th style="text-align:right">Total Amount</th>
            <th>Status</th>
            <th>Paid On</th>
        </tr>
    </thead>
    <tbody>${rows}
        <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000;">
            <td colspan="2">Total (${active.length} suppliers)</td>
            <td style="text-align:right">${fmtR(totalAmount)}</td>
            <td>${paidCount} paid</td>
            <td></td>
        </tr>
    </tbody>
</table>
<div class="totals">
    <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    <span>Authorised Signatory: ________________</span>
</div>
<script>window.onload = function() { window.print(); };</script>
</body></html>`);
        win.document.close();
    };

    // ── Excel Export ────────────────────────────────────────────
    const handleExcelExport = async () => {
        try {
            const response = await api.get(
                `/product-purchase-payments/export-excel?from=${customFrom}&to=${customTo}`,
                { responseType: 'blob' }
            );
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `product_purchase_payments_${customFrom}_to_${customTo}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            const text = await err.response?.data?.text?.();
            let msg = 'Export failed';
            try { msg = JSON.parse(text)?.message || msg; } catch { }
            showFlash('error', msg);
        }
    };

    // ── Tour ──────────────────────────────────────────────────
    const startTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                { element: '[data-tour="header"]', popover: { title: 'Product Purchase Payments', description: 'Manage payments to suppliers for product purchases.' } },
                { element: '[data-tour="date-range"]', popover: { title: 'Payment Cycle', description: 'Select the cycle for which you want to view and process payments.' } },
                { element: '[data-tour="stats"]', popover: { title: 'Summary', description: 'Quick overview of total suppliers and amounts for the cycle.' } },
                { element: '[data-tour="supplier-list"]', popover: { title: 'Suppliers', description: 'Each row shows a supplier and their total purchase amount. Click to expand details, or use Pay/PDF/Undo buttons.' } },
            ],
        });
        driverObj.drive();
    };

    // ── Permission check ──────────────────────────────────────
    if (permLoading) return <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center"><div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" /></div>;
    if (!cycleConfigLoaded) return <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center"><div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" /></div>;
    if (!can('product_purchases', 'R')) return <AccessDenied />;

    // ── Pagination ──────────────────────────────────────────────
    const filtered = suppliers.filter(s => {
        const matchSearch = s.supplier_name.toLowerCase().includes(search.toLowerCase());
        const matchPaid = filterPaid === "all" ? true : filterPaid === "paid" ? s.is_paid : !s.is_paid;
        return matchSearch && matchPaid;
    });

    const totalPages = Math.ceil(filtered.length / pageSize);
    const paginated = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const activeSuppliers = suppliers.filter(s => parseFloat(s.total_amount || 0) > 0);
    const totalAmount = activeSuppliers.reduce((a, s) => a + parseFloat(s.total_amount || 0), 0);
    const paidCount = activeSuppliers.filter(s => s.is_paid).length;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print" data-tour="header">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md">
                            <ShoppingBag size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('productPurchasePayments.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">{t('productPurchasePayments.pageSubtitle')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button onClick={startTour} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition">
                            <BadgeCheck size={13} /> Take a Tour
                        </button>
                        <button onClick={() => { setBillSearchOpen(true); searchBills(""); }} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 transition">
                            <FileSearch size={13} /> {t('productPurchasePayments.searchBills')}
                        </button>
                        {useCustomCycle && (
                            <button onClick={() => setCycleConfigOpen(true)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-100 text-violet-700 text-sm font-semibold hover:bg-violet-200 transition border border-violet-200">
                                <Calendar size={13} /> {t('productPurchasePayments.configureCycle')}
                            </button>
                        )}
                        <button onClick={printRegister} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition">
                            <Printer size={13} /> {t('productPurchasePayments.printRegister')}
                        </button>
                        <button onClick={handleBulkDownloadPDFs} disabled={bulkDownloading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50">
                            {bulkDownloading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                            {bulkDownloading ? 'Downloading…' : t('productPurchasePayments.bulkDownloadAllPDFs')}
                        </button>
                        <button onClick={handleCombinedDownload} disabled={combinedDownloading} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50">
                            {combinedDownloading ? <RefreshCw size={13} className="animate-spin" /> : <Download size={13} />}
                            {combinedDownloading ? 'Processing…' : t('productPurchasePayments.combinedDownloadAll')}
                        </button>
                        <button onClick={handleExcelExport} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
                            <Download size={13} /> Excel
                        </button>
                    </div>
                </div>

                {/* Date Range */}
                <div className="flex flex-col gap-3 no-print" data-tour="date-range">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                            <button type="button" onClick={() => handleCycleModeToggle(false)} className={`px-3 py-2 transition ${!useCustomCycle ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {t('productPurchasePayments.fixedMonthly')}
                            </button>
                            <button type="button" onClick={() => handleCycleModeToggle(true)} className={`px-3 py-2 transition ${useCustomCycle ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                {t('productPurchasePayments.customCycle')}
                            </button>
                        </div>
                        {!useCustomCycle && (
                            <div className="flex items-center gap-1.5">
                                {getFixedMonthCycles(new Date()).map((c, idx) => (
                                    <button key={c.label} type="button" onClick={() => selectFixedCycle(idx)} className={`px-3 py-2 rounded-xl text-xs font-semibold border transition ${activeFixedIdx === idx ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                                        {c.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.from')}</span>
                            <input type="date" value={customFrom || ''} disabled={!useCustomCycle} onChange={e => setCustomFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.to')}</span>
                            <input type="date" value={customTo || ''} disabled={!useCustomCycle} onChange={e => setCustomTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition disabled:bg-gray-50 disabled:text-gray-400" />
                        </div>
                        <div className="flex flex-col gap-0.5 ml-4 pl-4 border-l border-gray-200">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.paymentDate')}</span>
                            <input type="date" value={simulatedToday} onChange={e => setSimulatedToday(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3" data-tour="stats">
                    <StatCard label={t('productPurchasePayments.totalSuppliers')} value={activeSuppliers.length} icon={<Users size={14} />} color="text-blue-600 bg-blue-50 border-blue-100" />
                    <StatCard label={t('productPurchasePayments.totalAmount')} value={fmt(totalAmount)} icon={<Banknote size={14} />} color="text-emerald-600 bg-emerald-50 border-emerald-100" />
                    <StatCard label={t('productPurchasePayments.paidCount')} value={`${paidCount} / ${activeSuppliers.length}`} sub={t('productPurchasePayments.paid')} icon={<CheckCircle2 size={14} />} color="text-violet-600 bg-violet-50 border-violet-100" />
                </div>

                {/* Progress bar */}
                <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4 flex items-center gap-4 no-print">
                    <div className="flex flex-col gap-1 flex-1">
                        <div className="flex justify-between text-xs font-medium text-gray-500 mb-1">
                            <span>{t('productPurchasePayments.paymentProgress')}</span>
                            <span className="text-gray-700 font-semibold">{paidCount} / {activeSuppliers.length} {t('productPurchasePayments.paid')}</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: activeSuppliers.length ? `${(paidCount / activeSuppliers.length) * 100}%` : "0%" }} />
                        </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold">
                        <CheckCircle2 size={13} /> {activeSuppliers.length > 0 ? Math.round((paidCount / activeSuppliers.length) * 100) : 0}% {t('productPurchasePayments.done')}
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Search + Filter */}
                <div className="flex items-center gap-2 no-print">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('productPurchasePayments.searchPlaceholder')} className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[["all", t('productPurchasePayments.all')], ["unpaid", t('productPurchasePayments.unpaid')], ["paid", t('productPurchasePayments.paid')]].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterPaid(v)} className={`px-3 py-2 transition ${filterPaid === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>{l}</button>
                        ))}
                    </div>
                </div>

                {/* Supplier Cards */}
                <div className="flex flex-col gap-3" data-tour="supplier-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <ShoppingBag size={32} />
                            <p className="text-sm">{t('productPurchasePayments.noSuppliersFound')}</p>
                        </div>
                    ) : paginated.map(supplier => {
                        const isOpen = expanded[supplier.supplier_name] || false;
                        const total = parseFloat(supplier.total_amount || 0);
                        const entries = supplier.entries || [];

                        return (
                            <div key={supplier.supplier_name} className={`bg-white rounded-2xl border transition ${supplier.is_paid ? "border-emerald-200" : "border-gray-200"}`}>
                                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer" onClick={() => setExpanded(p => ({ ...p, [supplier.supplier_name]: !p[supplier.supplier_name] }))}>
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${supplier.is_paid ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                                        {supplier.supplier_name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{supplier.supplier_name}</p>
                                            {supplier.is_paid ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                                    <CheckCircle2 size={9} /> {t('productPurchasePayments.paid')}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                                    <Clock size={9} /> {t('productPurchasePayments.pending')}
                                                </span>
                                            )}
                                            {supplier.is_paid && supplier.bill_no && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                                                    <Hash size={8} /> {supplier.bill_no}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{entries.length} purchase{entries.length !== 1 ? 's' : ''}</p>
                                    </div>

                                    <div className="hidden sm:flex items-center gap-6 text-right mr-4">
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.amount')}</p>
                                            <p className="text-base font-bold text-gray-900">{fmt(total)}</p>
                                        </div>
                                    </div>

                                    {supplier.is_paid ? (
                                        <>
                                            <button onClick={(e) => { e.stopPropagation(); downloadReceiptPDF(supplier); }} className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold transition shadow-sm">
                                                <Printer size={11} /> {t('productPurchasePayments.pdf')}
                                            </button>
                                            <button onClick={(e) => handleUndo(e, supplier)} className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold transition disabled:opacity-50 shadow-sm shadow-rose-200">
                                                <RefreshCw size={11} /> {t('productPurchasePayments.undo')}
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={(e) => { e.stopPropagation(); handleMarkPaid(supplier); }} disabled={paying === supplier.supplier_name || !isTodayPaymentDay(customFrom, customTo)} title={!isTodayPaymentDay(customFrom, customTo) ? `Payment only on ${fmtDate(customTo)}` : undefined} className="shrink-0 no-print flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm shadow-emerald-200">
                                            {paying === supplier.supplier_name ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                                            {isTodayPaymentDay(customFrom, customTo) ? `${t('productPurchasePayments.pay')} ₹${total.toFixed(0)}` : `Pay on ${fmtDate(customTo)}`}
                                        </button>
                                    )}
                                    <div className="shrink-0 text-gray-300">{isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</div>
                                </div>

                                {/* Mobile amount */}
                                <div className="flex sm:hidden items-center justify-between px-5 pb-3 gap-3 text-xs flex-wrap">
                                    <span className="font-bold text-gray-900">{t('productPurchasePayments.total')}: {fmt(total)}</span>
                                    <span className="text-gray-400">{entries.length} purchases</span>
                                </div>

                                {/* Expanded details */}
                                {isOpen && (
                                    <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
                                        {entries.length > 0 && (
                                            <div>
                                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('productPurchasePayments.purchaseDetails')}</p>
                                                <div className="rounded-xl border border-gray-100 overflow-hidden">
                                                    <div className="grid bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: "1fr 80px 90px 90px 100px" }}>
                                                        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{t('productPurchasePayments.product')}</div>
                                                        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">{t('productPurchasePayments.qty')}</div>
                                                        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">{t('productPurchasePayments.rate')}</div>
                                                        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">{t('productPurchasePayments.mrp')}</div>
                                                        <div className="px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide text-right">{t('productPurchasePayments.amount')}</div>
                                                    </div>
                                                    {entries.map((e, i) => (
                                                        <div key={i} className="grid border-b border-gray-50 last:border-0 hover:bg-gray-50 transition" style={{ gridTemplateColumns: "1fr 80px 90px 90px 100px" }}>
                                                            <div className="px-3 py-2 text-xs text-gray-700">{e.product_name}</div>
                                                            <div className="px-3 py-2 text-xs text-gray-600 text-right font-mono">{parseFloat(e.quantity).toFixed(2)} {e.unit}</div>
                                                            <div className="px-3 py-2 text-xs text-amber-600 text-right font-mono">{fmt(e.rate)}</div>
                                                            <div className="px-3 py-2 text-xs text-violet-600 text-right font-mono">{e.mrp_rate ? fmt(e.mrp_rate) : '—'}</div>
                                                            <div className="px-3 py-2 text-xs text-gray-800 text-right font-bold">{fmt(e.total_amount)}</div>
                                                        </div>
                                                    ))}
                                                    <div className="grid bg-gray-50 border-t border-gray-100 font-bold" style={{ gridTemplateColumns: "1fr 80px 90px 90px 100px" }}>
                                                        <div className="px-3 py-2 text-xs text-gray-600 col-span-4 text-right">{t('productPurchasePayments.total')}</div>
                                                        <div className="px-3 py-2 text-xs text-gray-900 text-right">{fmt(total)}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {supplier.is_paid && supplier.paid_at && (
                                            <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                                                <CheckCircle2 size={13} />
                                                {t('productPurchasePayments.paidOn')} {fmtDate(supplier.paid_at)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Pagination */}
                {filtered.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">{t('productPurchasePayments.prev')}</button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce((acc, p, idx, arr) => { if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...'); acc.push(p); return acc; }, []).map((p, i) => p === '...' ? <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">…</span> : <button key={p} onClick={() => setCurrentPage(p)} className={`w-7 h-7 rounded-lg text-xs font-semibold transition border ${currentPage === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>{p}</button>)}
                            </div>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">{t('productPurchasePayments.next')}</button>
                            <span className="text-xs text-gray-400 ml-1">{filtered.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filtered.length)}`} of {filtered.length}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('productPurchasePayments.rowsPerPage')}</span>
                            <input type="number" min={1} max={filtered.length || 1} value={pageSize} onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }} className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>
                    </div>
                )}

                {/* Grand total */}
                {filtered.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-6 text-sm">
                            <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.totalSuppliers')}</p><p className="font-bold text-gray-800">{activeSuppliers.length}</p></div>
                            <div><p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.totalAmount')}</p><p className="font-bold text-gray-800">{fmt(totalAmount)}</p></div>
                            <div><p className="text-[10px] text-emerald-400 uppercase tracking-wider">{t('productPurchasePayments.paid')}</p><p className="font-bold text-emerald-600">{paidCount}</p></div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-gray-400 uppercase tracking-wider">{t('productPurchasePayments.netPayable')}</p>
                            <p className="text-2xl font-bold text-gray-900">{fmt(totalAmount)}</p>
                        </div>
                    </div>
                )}

            </main>

            {/* Bill Search Modal */}
            {billSearchOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-5xl h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center"><FileSearch size={16} className="text-white" /></div>
                                <div><h2 className="text-sm font-bold text-gray-900">{t('productPurchasePayments.billRegistry')}</h2><p className="text-[10px] text-gray-400">{t('productPurchasePayments.billRegistryDesc')}</p></div>
                            </div>
                            <button onClick={() => { setBillSearchOpen(false); setBillDetail(null); setBillResults([]); setBillQuery(""); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition"><X size={15} /></button>
                        </div>
                        <div className="px-6 py-3 border-b border-gray-100 flex items-center gap-3 flex-wrap shrink-0 bg-gray-50/60">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                                <input autoFocus value={billQuery} onChange={(e) => { setBillQuery(e.target.value); searchBills(e.target.value); setBillDetail(null); }} placeholder={t('productPurchasePayments.billSearchPlaceholder')} className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 transition placeholder:text-gray-300" />
                                {billLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" /></div>}
                            </div>
                            <button onClick={() => { setBillQuery(""); searchBills(""); setBillDetail(null); }} className="text-xs text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl border border-gray-200 bg-white transition">{t('productPurchasePayments.showAll')}</button>
                            <span className="text-xs text-gray-400 font-medium">{billResults.length > 0 ? `${billResults.length} ${billResults.length !== 1 ? 'bills' : 'bill'}` : ""}</span>
                        </div>

                        <div className="flex flex-1 min-h-0 overflow-hidden">
                            <div className="w-full flex flex-col overflow-hidden">
                                <div className="grid px-4 py-2 bg-gray-50 border-b border-gray-100 text-[10px] font-semibold text-gray-400 uppercase tracking-wider shrink-0" style={{ gridTemplateColumns: "1fr 1fr 120px 100px 80px 60px" }}>
                                    <div>Bill No</div><div>Supplier</div><div>Period</div><div className="text-right">Amount</div><div></div><div></div>
                                </div>
                                <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                                    {billLoading ? (
                                        <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-gray-200 border-t-violet-500 rounded-full animate-spin" /></div>
                                    ) : billResults.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300"><FileText size={32} /><p className="text-xs">{t('productPurchasePayments.noBillsFound')}</p></div>
                                    ) : billResults.map(b => (
                                        <button key={b.bill_id} onClick={() => loadBillDetail(b.bill_no)} className={`w-full text-left px-4 py-3 hover:bg-violet-50/60 transition grid items-center gap-2 ${billDetail?.bill?.bill_no === b.bill_no ? "bg-violet-50 border-l-2 border-l-violet-500" : "border-l-2 border-l-transparent"}`} style={{ gridTemplateColumns: "1fr 1fr 120px 100px 80px 60px" }}>
                                            <div><span className="text-xs font-mono font-bold text-violet-700">{b.bill_no}</span><p className="text-[10px] text-gray-400 mt-0.5">{t('productPurchasePayments.paid')}: {fmtDate(b.paid_at)}</p></div>
                                            <div><p className="text-xs font-semibold text-gray-800 truncate">{b.supplier_name}</p></div>
                                            <div className="text-[10px] text-gray-500">{fmtDate(b.from_date)} → {fmtDate(b.to_date)}</div>
                                            <div className="text-right"><span className="text-xs font-bold text-emerald-600">{fmt(b.total_amount)}</span></div>
                                            <div className="flex justify-end">
                                                <button onClick={async (e) => { e.stopPropagation(); const { data } = await api.get(`/product-purchase-payments/bill/${b.bill_no}`); printReceipt(e, { supplier_name: b.supplier_name, bill_no: b.bill_no, total_amount: b.total_amount, entries: data.items || [], is_paid: true, paid_at: b.paid_at }); }} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 text-white text-[10px] font-semibold hover:bg-gray-700 transition"><Printer size={9} /> PDF</button>
                                            </div>
                                            <div className="flex justify-end">
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteBill(b.bill_no); }} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-600 text-white text-[10px] font-semibold hover:bg-rose-700 transition"><Trash2 size={9} /> Del</button>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirm Modal */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center"><Trash2 size={18} className="text-rose-600" /></div><div><h2 className="text-sm font-bold text-gray-900">{t('productPurchasePayments.deleteBill')}</h2><p className="text-[10px] text-gray-400">{t('productPurchasePayments.deleteWarning')}</p></div></div>
                            <button onClick={cancelDeleteBill} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition"><X size={15} /></button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-3">
                            <p className="text-sm text-gray-600">{t('productPurchasePayments.deleteConfirmMessage')} <strong className="font-mono text-rose-700">{deletingBill}</strong>?</p>
                            <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-xs text-rose-700 flex flex-col gap-1">
                                <p className="font-semibold">{t('productPurchasePayments.willBeReversed')}:</p>
                                <ul className="list-disc list-inside text-rose-600 mt-1 space-y-0.5">
                                    <li>{t('productPurchasePayments.reversalPaymentRecord')}</li>
                                    <li>{t('productPurchasePayments.reversalSupplierStatus')}</li>
                                </ul>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={cancelDeleteBill} className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">{t('productPurchasePayments.cancel')}</button>
                            <button onClick={confirmDeleteBill} disabled={deleting} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-50">
                                {deleting ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Trash2 size={12} />}
                                {deleting ? t('productPurchasePayments.deleting') : t('productPurchasePayments.yesDeleteBill')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Cycle Config Modal */}
            <CycleConfigModal
                open={cycleConfigOpen}
                onClose={() => setCycleConfigOpen(false)}
                onSave={async (seed, days) => {
                    try {
                        await api.post('/product-purchase-payments/cycle-config', { seed_from: seed, days_per_cycle: days });
                        setCycleSeedFrom(seed);
                        setCycleDaysPerCycle(days);
                        const active = getActiveCycle(seed, days);
                        if (active) { setCustomFrom(active.from); setCustomTo(active.to); }
                        setCycleConfigOpen(false);
                        showFlash("success", "Cycle configuration saved!");
                    } catch (err) {
                        showFlash("error", "Failed to save cycle config.");
                    }
                }}
                initialSeed={cycleSeedFrom}
                initialDays={cycleDaysPerCycle}
                computeCycles={computeCycles}
            />

        </div>
    );
}