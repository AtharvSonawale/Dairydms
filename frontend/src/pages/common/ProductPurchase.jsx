import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Package, Save, User, AlertTriangle,
    BadgeCheck, RefreshCw, X, TrendingUp,
    ShoppingBag, Layers, Banknote, FileDown,
} from "lucide-react";
import api from "../../api/axios";
import { usePermission } from '../../context/PermissionContext';
import AccessDenied from '../../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── helpers ───────────────────────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const EMPTY_FORM = {
    product_id: "",
    supplier_name: "",
    quantity: "",
    rate: "",
    mrp_rate: "",
};

// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1 shrink-0">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {icon}{label}
            </span>
            {children}
        </div>
    );
}

function TinyInput({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={`border border-gray-200 rounded-xl px-2.5 py-[7px] text-sm text-gray-900 bg-gray-50
                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-50 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function ProductPurchase() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();
    const [form, setForm] = useState(EMPTY_FORM);
    const [purchases, setPurchases] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [selectedDate, setSelectedDate] = useState(today());
    const [showNewProduct, setShowNewProduct] = useState(false);
    const [newProduct, setNewProduct] = useState({ product_name: "", unit: "", supplier_name: "", quantity: "", rate: "", mrp_rate: "" });
    const [savingProduct, setSavingProduct] = useState(false);
    const [supplierSuggestions, setSupplierSuggestions] = useState([]);
    const [showSupplierDrop, setShowSupplierDrop] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [showProductDrop, setShowProductDrop] = useState(false);
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const [editingPurchase, setEditingPurchase] = useState(null); // { purchase_id, quantity, rate, mrp_rate, supplier_name, purchase_date }
    const [editSaving, setEditSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);

    const handleAddProduct = async (e) => {
        e.preventDefault();
        if (!newProduct.product_name.trim()) return;
        if (!newProduct.unit.trim()) return;
        setSavingProduct(true);
        try {
            const { data } = await api.post("/products", {
                product_name: newProduct.product_name.trim(),
                unit: newProduct.unit.trim(),
                supplier_name: newProduct.supplier_name.trim() || null,
                rate: parseFloat(newProduct.rate) || null,
                mrp_rate: parseFloat(newProduct.mrp_rate) || null,
            });

            if (newProduct.supplier_name?.trim() && newProduct.quantity && newProduct.rate) {
                const qty = parseFloat(newProduct.quantity);
                const rate = parseFloat(newProduct.rate);
                await api.post("/products/purchases", {
                    product_id: data.product_id,
                    supplier_name: newProduct.supplier_name.trim(),
                    quantity: qty,
                    rate: rate,
                    mrp_rate: parseFloat(newProduct.mrp_rate) || null,
                    total_amount: parseFloat((qty * rate).toFixed(2)),
                    purchase_date: selectedDate,
                });
                await fetchPurchases(selectedDate);
            }

            await fetchProducts();
            set("product_id", String(data.product_id));
            setNewProduct({ product_name: "", unit: "", supplier_name: "", quantity: "", rate: "", mrp_rate: "" });
            setShowNewProduct(false);
            showFlash("success", t('productPurchase.addProductSuccess', { name: data.product_name }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('productPurchase.addProductError'));
        } finally {
            setSavingProduct(false);
        }
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startPurchaseTour = () => {
    const driverObj = driver({
        showProgress: true,
        allowClose: true,
        steps: [
            {
                element: '[data-tour="purchase-date"]',
                popover: { title: t('productPurchase.dateLabel'), description: 'Select a date to view or record purchases. Use the range buttons to switch between daily, weekly, monthly, or custom views — then download a PDF report.' },
            },
            {
                element: '[data-tour="purchase-stats"]',
                popover: { title: t('productPurchase.purchasesToday'), description: 'See total purchase entries and the total amount spent for the selected date or range.' },
            },
            {
                element: '[data-tour="purchase-form"]',
                popover: { title: t('productPurchase.newPurchaseEntry'), description: 'Select a product, enter the supplier, quantity, rate and MRP. The total is computed automatically. Hit Record Purchase to save.' },
            },
            {
                element: '[data-tour="purchases-table"]',
                popover: { title: t('productPurchase.colProduct'), description: 'All purchases for the selected period are listed here. Use the edit or delete buttons on each row to make corrections — stock is adjusted automatically.' },
            },
        ],
    });
    driverObj.drive();
};

    const getWeekRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const day = dt.getDay();
        const monOffset = day === 0 ? -6 : 1 - day;
        const mon = new Date(dt);
        mon.setDate(dt.getDate() + monOffset);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        return {
            from: mon.toISOString().split("T")[0],
            to: sun.toISOString().split("T")[0],
        };
    };

    const getMonthRange = (d) => {
        const dt = new Date(d + "T00:00:00");
        const y = dt.getFullYear(), m = dt.getMonth();
        return {
            from: new Date(y, m, 1).toISOString().split("T")[0],
            to: new Date(y, m + 1, 0).toISOString().split("T")[0],
        };
    };

    const handleRangeModeChange = (mode) => {
        setRangeMode(mode);
        setPdfReady(false);
        let newFrom = fromDate, newTo = toDate;
        if (mode === "daily") { newFrom = selectedDate; newTo = selectedDate; }
        else if (mode === "weekly") { const r = getWeekRange(selectedDate); newFrom = r.from; newTo = r.to; }
        else if (mode === "monthly") { const r = getMonthRange(selectedDate); newFrom = r.from; newTo = r.to; }
        setFromDate(newFrom);
        setToDate(newTo);
        if (mode !== "daily" && mode !== "custom") fetchRangeEntries(newFrom, newTo);
    };

    const fetchRangeEntries = async (from = fromDate, to = toDate) => {
        setLoadingRange(true);
        try {
            const url = from === to
                ? `/products/purchases?date=${from}`
                : `/products/purchases?from=${from}&to=${to}`;
            const { data } = await api.get(url);
            setRangeEntries(data);
            setPdfReady(true);
        } catch {
            showFlash("error", t('productPurchase.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
    };

    // ADD after fetchRangeEntries function:

    const handleEditSave = async () => {
        if (!editingPurchase) return;
        setEditSaving(true);
        try {
            await api.put(`/products/purchases/${editingPurchase.purchase_id}`, {
                product_id: Number(editingPurchase.product_id),
                product_name: editingPurchase.product_name.trim(),
                quantity: parseFloat(editingPurchase.quantity),
                rate: parseFloat(editingPurchase.rate),
                mrp_rate: parseFloat(editingPurchase.mrp_rate) || null,
                supplier_name: editingPurchase.supplier_name,
                purchase_date: selectedDate,
            });
            await Promise.all([
                fetchPurchases(selectedDate),
                fetchProducts(),
                fetchRangeEntries(fromDate, toDate),
            ]);
            setEditingPurchase(null);
            showFlash("success", t('productPurchase.saveSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('productPurchase.saveError'));
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (purchaseId) => {
        if (!window.confirm(t('productPurchase.deleteConfirm') || "Delete this purchase? Stock will be reversed.")) return;
        setDeletingId(purchaseId);
        try {
            await api.delete(`/products/purchases/${purchaseId}`);
            await Promise.all([
                fetchPurchases(selectedDate),
                fetchProducts(),
                fetchRangeEntries(fromDate, toDate),
            ]);
            showFlash("success", t('productPurchase.deleteSuccess') || "Purchase deleted.");
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Delete failed.");
        } finally {
            setDeletingId(null);
        }
    };

    const totalAmount =
        form.quantity && form.rate
            ? (parseFloat(form.quantity || 0) * parseFloat(form.rate || 0)).toFixed(2)
            : null;

    const fetchProducts = async () => {
        try {
            const { data } = await api.get("/products");
            setProducts(data);
            if (data.length > 0) {
                set("product_id", String(data[0].product_id));
            }
        } catch { /* silent */ }
    };

    const fetchPurchases = async (date) => {
        setLoading(true);
        try {
            const { data } = await api.get(`/products/purchases?date=${date}`);
            setPurchases(data);
        } catch {
            showFlash("error", t('productPurchase.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const fetchSupplierSuggestions = async (productId) => {
        if (!productId) { setSupplierSuggestions([]); return []; }
        try {
            const { data } = await api.get(`/products/purchases/suggestions?product_id=${productId}`);
            setSupplierSuggestions(data);
            return data;
        } catch {
            setSupplierSuggestions([]);
            return [];
        }
    };

    useEffect(() => { fetchProducts(); }, []);
    useEffect(() => { fetchPurchases(selectedDate); }, [selectedDate]);

    useEffect(() => {
        if (!form.product_id) return;

        // autofill rate/mrp from product master
        const product = products.find(p => String(p.product_id) === String(form.product_id));
        if (product) {
            setForm(prev => ({
                ...prev,
                rate: product.rate ? String(product.rate) : prev.rate,
                mrp_rate: product.mrp_rate ? String(product.mrp_rate) : prev.mrp_rate,
            }));
        }

        // autofill supplier_name + rate from last purchase suggestion
        fetchSupplierSuggestions(form.product_id).then((suggestions) => {
            if (suggestions && suggestions.length >= 1) {
                const top = suggestions[0];
                setForm(prev => ({
                    ...prev,
                    supplier_name: top.supplier_name || prev.supplier_name,
                    rate: top.rate ? String(top.rate) : prev.rate,
                }));
            }
        });
    }, [form.product_id, products]);

    const selectedProduct = products.find((p) => String(p.product_id) === String(form.product_id));

    const handleSave = async () => {
        if (!form.product_id) { showFlash("error", t('productPurchase.selectProductError')); return; }
        if (!form.supplier_name.trim()) { showFlash("error", t('productPurchase.supplierRequired')); return; }
        if (!form.quantity) { showFlash("error", t('productPurchase.qtyRequired')); return; }
        if (!form.rate) { showFlash("error", t('productPurchase.rateRequired')); return; }
        if (saving) return;

        setSaving(true);
        try {
            await api.post("/products/purchases", {
                product_id: Number(form.product_id),
                supplier_name: form.supplier_name.trim(),
                quantity: parseFloat(form.quantity),
                rate: parseFloat(form.rate),
                mrp_rate: parseFloat(form.mrp_rate) || null,
                total_amount: parseFloat(totalAmount),
                purchase_date: selectedDate,
            });
            await fetchPurchases(selectedDate);
            showFlash("success", t('productPurchase.saveSuccess'));
            const firstProduct = products[0];
            setForm({
                ...EMPTY_FORM,
                product_id: firstProduct ? String(firstProduct.product_id) : "",
                rate: firstProduct?.rate ? String(firstProduct.rate) : "",
                mrp_rate: firstProduct?.mrp_rate ? String(firstProduct.mrp_rate) : "",
            });
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('productPurchase.saveError'));
        } finally {
            setSaving(false);
        }
    };

    const handleDownloadPDF = () => {
        const baseData = rangeMode === "daily" ? purchases : (pdfReady ? rangeEntries : purchases);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const fmtD = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
        const modeLabel = rangeMode === "daily" ? t('productPurchase.pdfDaily')
            : rangeMode === "weekly" ? t('productPurchase.pdfWeekly')
                : rangeMode === "monthly" ? t('productPurchase.pdfMonthly')
                    : t('productPurchase.pdfCustom');
        const periodLabel = fromDate === toDate ? fmtD(fromDate) : `${fmtD(fromDate)} ${t('productPurchase.pdfTo')} ${fmtD(toDate)}`;
        const dateStr = periodLabel;

        const grandQty = {};
        baseData.forEach(p => {
            const u = p.unit || "units";
            grandQty[u] = (grandQty[u] || 0) + parseFloat(p.quantity || 0);
        });

        const totalSpentCalc = baseData.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
        const uniqueSuppliersCount = [...new Set(baseData.map(p => p.supplier_name))].length;

        const rows = [...baseData].reverse().map((p, i) => `
        <tr style="background:${i % 2 === 0 ? "#fff" : "#f9fafb"}">
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;font-weight:600;color:#000">${p.product_name || `ID:${p.product_id}`}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000">${p.unit || "—"}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;color:#000">
                <div style="display:flex;align-items:center;gap:4px">
                    <span style="background:#e0e0e0;color:#000;width:16px;height:16px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:700">
                        ${(p.supplier_name || "?").charAt(0).toUpperCase()}
                    </span>
                    ${p.supplier_name || "—"}
                </div>
            </td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:600;color:#000">${parseFloat(p.quantity).toFixed(2)}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">₹${parseFloat(p.rate).toFixed(2)}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:9px;text-align:right;color:#000">${p.mrp_rate ? `₹${parseFloat(p.mrp_rate).toFixed(2)}` : "—"}</td>
            <td style="padding:4px 6px;border:1px solid #999;font-size:8px;color:#333;font-family:monospace">
                ${p.purchase_date ? new Date(p.purchase_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                ${p.created_at ? `<br/><span style="font-size:8px">${new Date(p.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>` : ""}
            </td>
            <td style="padding:4px 6px;border:1px solid #999;background:#e0e0e0;font-size:9px;text-align:right;font-weight:700;color:#000">₹${parseFloat(p.total_amount).toFixed(2)}</td>
        </tr>
        `).join("");

        win.document.write(`<!DOCTYPE html><html><head>
        <title>${t('productPurchase.pdfTitle')} — ${dateStr}</title>
        <style>
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            body { font-family: Arial, sans-serif; font-size: 9px; color: #000; margin: 0; padding: 16px; background: #fff; }
            table { border-collapse: collapse; width: 100%; }
            @media print {
                @page { margin: 8mm; size: A4 portrait; }
                body { padding: 0; }
            }
            @media screen {
                body { max-width: 175mm; margin: 0 auto; }
            }
        </style>
    </head><body>

    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;border-bottom:2px solid #000;padding-bottom:10px">
        <div>
            <div style="font-size:18px;font-weight:bold;color:#000">${t('productPurchase.pdfTitle')}</div>
            <div style="font-size:11px;color:#333;margin-top:3px">${modeLabel} ${t('productPurchase.pdfReport')} · ${periodLabel}</div>
            <div style="font-size:10px;color:#555;margin-top:2px">${t('productPurchase.pdfGenerated')} ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
        </div>
        <div style="display:flex;gap:10px">
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('productPurchase.pdfEntries')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${baseData.length}</div>
            </div>
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('productPurchase.pdfSuppliers')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">${uniqueSuppliersCount}</div>
            </div>
            <div style="background:#f2f2f2;border:1px solid #999;padding:8px 14px;border-radius:4px;text-align:center">
                <div style="font-size:9px;color:#333;font-weight:600;text-transform:uppercase">${t('productPurchase.pdfTotalSpent')}</div>
                <div style="font-size:16px;font-weight:700;color:#000">₹${totalSpentCalc.toFixed(2)}</div>
            </div>
        </div>
    </div>

    <!-- Table -->
    <table>
        <thead>
            <tr style="background:#1e293b;color:#fff">
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:18%">${t('productPurchase.pdfProduct')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:7%">${t('productPurchase.pdfUnit')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:18%">${t('productPurchase.pdfSupplier')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:right;width:9%">${t('productPurchase.pdfQty')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:right;width:10%">${t('productPurchase.pdfRate')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:right;width:10%">${t('productPurchase.pdfMrp')}</th>
                <th style="padding:5px 6px;border:1px solid #444;font-size:9px;text-align:left;width:16%">${t('productPurchase.pdfDateTime')}</th>
                <th style="padding:5px 6px;border:1px solid #333;background:#333;font-size:9px;text-align:right;width:12%">${t('productPurchase.pdfAmount')}</th>
            </tr>
        </thead>
        <tbody>
            ${rows}
            <tr style="background:#e0e0e0;font-weight:bold;border-top:2px solid #000">
                <td colspan="3" style="padding:5px 6px;border:1px solid #999;font-size:9px;font-weight:700;color:#000">
                    ${t('productPurchase.pdfGrandTotal')} — ${baseData.length} ${t('productPurchase.pdfEntries')} · ${uniqueSuppliersCount} ${t('productPurchase.pdfSupplier')}${uniqueSuppliersCount !== 1 ? 's' : ''}
                </td>
                <td style="padding:5px 6px;border:1px solid #999;font-size:9px;text-align:right;font-weight:700;color:#000">
                    ${Object.entries(grandQty).map(([u, q]) => `${q.toFixed(2)} ${u}`).join(" · ")}
                </td>
                <td colspan="3" style="padding:5px 6px;border:1px solid #999;font-size:9px"></td>
                <td style="padding:5px 6px;border:1px solid #999;background:#d0d0d0;font-size:9px;text-align:right;font-weight:700;color:#000">₹${totalSpentCalc.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>

    <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8">
        <span>${t('productPurchase.pdfFooter')}</span>
        <span>${t('productPurchase.pdfSignatory')}</span>
    </div>

    <script>window.onload = () => { window.print(); };<\/script>
    </body></html>`);
        win.document.close();
    };

    const activeData = rangeMode === "daily" ? purchases : rangeEntries;
    const totalSpent = activeData.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
    const qtyByUnit = activeData.reduce((acc, p) => {
        const unit = p.unit || "units";
        acc[unit] = (acc[unit] || 0) + parseFloat(p.quantity || 0);
        return acc;
    }, {});
    const uniqueSuppliers = [...new Set(purchases.map((p) => p.supplier_name))].length;

    const COLS = [t('productPurchase.colProduct'), t('productPurchase.colSupplier'), t('productPurchase.colQty'), t('productPurchase.colRate'), t('productPurchase.colMrp'), t('productPurchase.colTotal'), t('productPurchase.colTime'), ""];
    const GRID = "1.6fr 1.2fr 80px 80px 80px 100px 70px 72px";

    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('product_purchases', 'R')) return <AccessDenied />;
    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <ShoppingBag size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('productPurchase.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('productPurchase.pageSubtitle')} —{" "}
                                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                            </p>
                        </div>
                    </div>

<div className="flex items-center gap-2 flex-wrap">
    <button
        onClick={startPurchaseTour}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm font-semibold hover:bg-gray-200 transition"
    >
        <BadgeCheck size={13} /> Take a Tour
    </button>
    <div className="flex flex-col gap-0.5" data-tour="purchase-date">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchase.dateLabel')}</span>
                            <input type="date" value={selectedDate}
                                onChange={(e) => {
                                    const d = e.target.value;
                                    setSelectedDate(d);
                                    setPdfReady(false);
                                    if (rangeMode === "daily") { setFromDate(d); setToDate(d); }
                                    else if (rangeMode === "weekly") { const r = getWeekRange(d); setFromDate(r.from); setToDate(r.to); }
                                    else if (rangeMode === "monthly") { const r = getMonthRange(d); setFromDate(r.from); setToDate(r.to); }
                                }}
                                className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white
                                    focus:outline-none focus:ring-2 focus:ring-black transition" />
                        </div>

                        </div>

    <div className="flex flex-col gap-0.5">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('productPurchase.downloadPDF')}</span>

                            <div className="flex flex-wrap items-center gap-1.5">
                                <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                                    {[{ v: "daily", l: t('productPurchase.day') }, { v: "weekly", l: t('productPurchase.week') }, { v: "monthly", l: t('productPurchase.month') }, { v: "custom", l: t('productPurchase.custom') }].map(({ v, l }) => (
                                        <button key={v} type="button" onClick={() => handleRangeModeChange(v)}
                                            className={`px-3 py-2 transition ${rangeMode === v ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                {rangeMode === "custom" && (
                                    <div className="flex flex-wrap items-center gap-1">
                                        <input type="date" value={fromDate} onChange={e => { const v = e.target.value; setFromDate(v); setPdfReady(false); fetchRangeEntries(v, toDate); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                        <span className="text-gray-400 text-xs">→</span>
                                        <input type="date" value={toDate} onChange={e => { const v = e.target.value; setToDate(v); setPdfReady(false); fetchRangeEntries(fromDate, v); }}
                                            className="border border-gray-200 rounded-xl px-2 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                                    </div>
                                )}

                                {rangeMode !== "custom" && (
                                    <span className="text-xs text-gray-500 px-2 py-1.5 bg-gray-50 border border-gray-200 rounded-xl whitespace-nowrap hidden sm:inline">
                                        {fromDate === toDate
                                            ? new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
                                            : `${new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })} → ${new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
                                    </span>
                                )}

                                {loadingRange ? (
                                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold">
                                        <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0" /></svg>
                                        {t('dashboard.loading')}
                                    </div>
                                ) : (
                                    <button onClick={handleDownloadPDF} disabled={rangeMode === "daily" ? purchases.length === 0 : !pdfReady}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 disabled:opacity-40 transition">
                                        <FileDown size={13} /> PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                {/* Stats */}
<div className="grid grid-cols-2 sm:grid-cols-2 gap-3" data-tour="purchase-stats">
                        {[
                        { label: rangeMode === "daily" ? t('productPurchase.purchasesToday') : t('productPurchase.purchasesInRange'), value: activeData.length, icon: <Package size={14} />, color: "text-blue-600 bg-blue-50 border-blue-100" },
                        { label: t('productPurchase.totalSpent'), value: "₹" + totalSpent.toFixed(2), icon: <Banknote size={14} />, color: "text-emerald-600 bg-emerald-50 border-emerald-100" },
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

                {/* Entry Form */}
               {can('product_purchases', 'C') && <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5" data-tour="purchase-form">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t('productPurchase.newPurchaseEntry')}</p>
                        {can('products', 'C') && (
                            <button type="button" onClick={() => setShowNewProduct(true)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-dashed border-gray-300
                                    text-gray-500 hover:border-black hover:text-black text-xs font-semibold transition">
                                <span className="text-base leading-none">+</span> {t('productPurchase.newProduct')}
                            </button>
                        )}
                    </div>

                    <div className="flex items-start gap-3 flex-wrap">

                        {/* Product select */}
                        <Field label={t('productPurchase.product')} icon={<Package size={12} />}>
                            <div className="relative">
                                <TinyInput
                                    value={productSearch !== "" ? productSearch : (products.find(p => String(p.product_id) === String(form.product_id))?.product_name || "")}
                                    onChange={(e) => { setProductSearch(e.target.value); setShowProductDrop(true); }}
                                    onFocus={() => { setProductSearch(""); setShowProductDrop(true); }}
                                    onBlur={() => setTimeout(() => setShowProductDrop(false), 150)}
                                    placeholder={t('productPurchase.searchProductPlaceholder')}
                                    className="w-52"
                                />
                                {showProductDrop && (
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden max-h-48 overflow-y-auto">
                                        <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            {t('productPurchase.products')}
                                        </p>
                                        {(productSearch.trim()
                                            ? products.filter(p => p.product_name.toLowerCase().includes(productSearch.toLowerCase()))
                                            : products
                                        ).map((p) => (
                                            <button key={p.product_id} type="button"
                                                onClick={() => {
                                                    setForm(prev => ({
                                                        ...prev,
                                                        product_id: String(p.product_id),
                                                        supplier_name: p.supplier_name || "",
                                                        rate: p.rate ? String(p.rate) : "",
                                                        mrp_rate: p.mrp_rate ? String(p.mrp_rate) : "",
                                                    }));
                                                    setProductSearch(p.product_name);
                                                    setShowProductDrop(false);
                                                    fetchSupplierSuggestions(p.product_id);
                                                    setShowSupplierDrop(true);
                                                }}
                                                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition">
                                                <div>
                                                    <p className="text-xs font-medium text-gray-800">{p.product_name}</p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {p.supplier_name && <span className="text-violet-500 font-semibold">{p.supplier_name}</span>}
                                                        {p.supplier_name && " · "}
                                                        {t('productPurchase.stock')}: {parseFloat(p.current_stock || 0).toFixed(1)} {p.unit}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] text-gray-300 font-mono">{p.unit}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedProduct && (
                                <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                                    {selectedProduct.supplier_name && (
                                        <><span className="text-violet-500 font-semibold">{selectedProduct.supplier_name}</span>{" · "}</>
                                    )}
                                    {t('productPurchase.unit')}: <span className="text-gray-600 font-semibold">{selectedProduct.unit}</span>
                                    {" · "}{t('productPurchase.stock')}: <span className="text-emerald-600 font-semibold">{parseFloat(selectedProduct.current_stock || 0).toFixed(1)}</span>
                                </p>
                            )}
                        </Field>

                        {/* Supplier name */}
                        <Field label={t('productPurchase.supplier')} icon={<User size={12} />}>
                            <div className="relative">
                                <TinyInput
                                    value={form.supplier_name}
                                    onChange={(e) => { set("supplier_name", e.target.value); setShowSupplierDrop(true); }}
                                    onFocus={() => setShowSupplierDrop(true)}
                                    onBlur={() => setTimeout(() => setShowSupplierDrop(false), 150)}
                                    placeholder={t('productPurchase.supplierPlaceholder')}
                                    className="w-40"
                                />
                                {showSupplierDrop && supplierSuggestions.length > 0 && (
                                    <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
                                        <p className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                                            {t('productPurchase.pastSuppliers')}
                                        </p>
                                        {supplierSuggestions
                                            .filter(s => !form.supplier_name || s.supplier_name.toLowerCase().includes(form.supplier_name.toLowerCase()))
                                            .map((s, i) => (
                                                <button key={i} type="button"
                                                    onClick={() => {
                                                        setForm(p => ({ ...p, supplier_name: s.supplier_name, rate: String(s.rate) }));
                                                        setShowSupplierDrop(false);
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-800">{s.supplier_name}</p>
                                                        <p className="text-[10px] text-gray-400">{t('productPurchase.lastRate')}: ₹{parseFloat(s.rate).toFixed(2)}</p>
                                                    </div>
                                                    <span className="text-[10px] text-emerald-600 font-semibold">↑ {t('productPurchase.autofill')}</span>
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>
                        </Field>

                        {selectedProduct?.supplier_name && form.supplier_name &&
                            form.supplier_name.trim().toLowerCase() !== selectedProduct.supplier_name.trim().toLowerCase() && (
                                <p className="text-[10px] text-amber-500 font-medium self-end mb-2 max-w-[140px]">
                                    New supplier — a separate product entry will be created.
                                </p>
                            )}

                        {/* Quantity */}
                        <Field label={t('productPurchase.quantity')} icon={<Layers size={12} />}>
                            <TinyInput
                                value={form.quantity}
                                onChange={(e) => set("quantity", e.target.value)}
                                placeholder="0.0" type="number" step="0.01"
                                className="w-20 bg-blue-50 border-blue-200 text-blue-700"
                            />
                            {selectedProduct && (
                                <p className="text-[10px] text-blue-400 font-medium mt-0.5">{selectedProduct.unit}</p>
                            )}
                        </Field>

                        {/* Rate */}
                        <Field label={t('productPurchase.rate')} icon={<TrendingUp size={12} />}>
                            <TinyInput
                                value={form.rate}
                                onChange={(e) => set("rate", e.target.value)}
                                placeholder="₹0.00" type="number" step="0.01"
                                className="w-20 bg-amber-50 border-amber-200 text-amber-700"
                            />
                        </Field>

                        {/* MRP */}
                        <Field label={t('productPurchase.mrp')} icon={<Banknote size={12} />}>
                            <TinyInput
                                value={form.mrp_rate}
                                onChange={(e) => set("mrp_rate", e.target.value)}
                                placeholder="₹0.00"
                                type="number"
                                step="0.01"
                                className="w-20 bg-violet-50 border-violet-200 text-violet-700"
                            />
                        </Field>

                        {/* Computed total */}
                        {totalAmount && (
                            <Field label={t('productPurchase.total')} icon={<Banknote size={12} />}>
                                <div className="h-[35px] px-4 flex items-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-sm whitespace-nowrap">
                                    ₹{totalAmount}
                                </div>
                            </Field>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-gray-100">
                        <p className="text-xs text-gray-400">
                            {purchases.length} {purchases.length === 1 ? t('productPurchase.purchase') : t('productPurchase.purchases')} {t('productPurchase.on')}{" "}
                            {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            {totalSpent > 0 && (
                                <span className="ml-2 text-emerald-600 font-semibold">· ₹{totalSpent.toFixed(2)} {t('productPurchase.spent')}</span>
                            )}
                        </p>
                        <button type="button" onClick={handleSave} disabled={saving}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all
                                ${saving ? "bg-gray-300 cursor-not-allowed" : "bg-black hover:bg-gray-800 active:scale-95"}`}>
                            <Save size={15} />
                            {saving ? t('productPurchase.saving') : t('productPurchase.recordPurchase')}
                        </button>
                    </div>
                </div>}

                {/* Purchases Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden" data-tour="purchases-table">

                {/* Header */}
                <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Rows */}
                    {loading || loadingRange ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : activeData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <ShoppingBag size={32} />
                            <p className="text-sm">
                                {rangeMode === "daily"
                                    ? t('productPurchase.noPurchasesDaily')
                                    : t('productPurchase.noPurchasesRange')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {[...activeData].reverse().map((p, i) => (
                                    <div key={p.purchase_id || i}
                                        className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                                        style={{ gridTemplateColumns: GRID }}>

                                        {/* Product */}
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                                                    <Package size={11} className="text-gray-500" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-gray-800 font-medium text-xs truncate">{p.product_name || `ID:${p.product_id}`}</span>
                                                    {p.unit && <span className="text-[10px] text-gray-400">{p.unit}</span>}
                                                </div>
                                            </div>
                                        </TableCell>

                                        {/* Supplier */}
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center text-violet-600 font-bold text-[10px] shrink-0">
                                                    {p.supplier_name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <span className="text-gray-700 text-xs font-medium truncate">{p.supplier_name}</span>
                                            </div>
                                        </TableCell>

                                        <TableCell className="text-blue-600 font-mono font-semibold text-xs">
                                            {parseFloat(p.quantity).toFixed(2)}
                                        </TableCell>

                                        <TableCell className="text-amber-700 font-mono text-xs font-semibold">
                                            ₹{parseFloat(p.rate).toFixed(2)}
                                        </TableCell>

                                        <TableCell className="text-violet-600 font-mono text-xs font-semibold">
                                            {p.mrp_rate ? `₹${parseFloat(p.mrp_rate).toFixed(2)}` : "—"}
                                        </TableCell>

                                        <TableCell className="text-gray-900 font-bold text-xs">
                                            ₹{parseFloat(p.total_amount).toFixed(2)}
                                        </TableCell>

                                        <TableCell className="text-gray-400 font-mono text-xs">
                                            {fmtTime(p.created_at)}
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                {can('product_purchases', 'U') && <button
                                                    onClick={() => setEditingPurchase({
                                                        purchase_id: p.purchase_id,
                                                        product_id: String(p.product_id),
                                                        product_name: p.product_name || `ID:${p.product_id}`,
                                                        quantity: String(p.quantity),
                                                        rate: String(p.rate),
                                                        mrp_rate: String(p.mrp_rate || ""),
                                                        supplier_name: p.supplier_name,
                                                        purchase_date: selectedDate,
                                                    })}
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-500 transition"
                                                    title="Edit"
                                                >
                                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                                                </button>}
                                                {can('product_purchases', 'D') && <button
                                                    onClick={() => handleDelete(p.purchase_id)}
                                                    disabled={deletingId === p.purchase_id}
                                                    className="w-6 h-6 flex items-center justify-center rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-400 transition disabled:opacity-40"
                                                    title="Delete"
                                                >
                                                    {deletingId === p.purchase_id
                                                        ? <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-18 0" /></svg>
                                                        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></svg>
                                                    }
                                                </button>}
                                            </div>
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Totals footer */}
                    {activeData.length > 0 && (
                        <div className="grid border-t-2 border-gray-100 bg-gray-50/80 min-w-max"
                            style={{ gridTemplateColumns: GRID }}>
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-100">
                                {activeData.length} {activeData.length === 1 ? t('productPurchase.entry') : t('productPurchase.entries')}
                            </div>
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 border-r border-gray-100" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-100">
                                ₹{totalSpent.toFixed(2)}
                            </div>
                            <div className="px-3 py-2.5" />
                            <div className="px-3 py-2.5 text-xs font-bold text-gray-900 border-r border-gray-100">
                                ₹{totalSpent.toFixed(2)}
                            </div>
                            <div className="px-3 py-2.5" />
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• <strong className="text-gray-600">{purchases.length}</strong> {purchases.length === 1 ? t('productPurchase.purchase') : t('productPurchase.purchases')} {t('productPurchase.recordedToday')}</span>
                    <span>• {t('productPurchase.stockUpdateNote')}</span>
                    <span>• {t('productPurchase.rateNote')}</span>
                </div>

            </main>

            {/* New Product Modal */}
            {showNewProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[420px] flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('productPurchase.addNewProduct')}</h2>
                                <p className="text-gray-400 text-xs mt-0.5">{t('productPurchase.addProductDesc')}</p>
                            </div>
                            <button onClick={() => setShowNewProduct(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>

                        <form onSubmit={handleAddProduct} className="flex flex-col gap-3">

                            {/* Product Name + Unit */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('productPurchase.productName')} <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        value={newProduct.product_name}
                                        onChange={(e) => setNewProduct(p => ({ ...p, product_name: e.target.value }))}
                                        placeholder={t('productPurchase.productNamePlaceholder')}
                                        required
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        {t('productPurchase.unit')} <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        value={newProduct.unit}
                                        onChange={(e) => setNewProduct(p => ({ ...p, unit: e.target.value }))}
                                        placeholder={t('productPurchase.unitPlaceholder')}
                                        required
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            {/* Divider */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 h-px bg-gray-100" />
                                <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">{t('productPurchase.firstPurchaseOptional')}</span>
                                <div className="flex-1 h-px bg-gray-100" />
                            </div>

                            {/* Supplier */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.supplierName')}</label>
                                <input
                                    value={newProduct.supplier_name || ""}
                                    onChange={(e) => setNewProduct(p => ({ ...p, supplier_name: e.target.value }))}
                                    placeholder={t('productPurchase.supplierPlaceholder')}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition"
                                />
                            </div>

                            {/* Qty + Rate + MRP */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.quantity')}</label>
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={newProduct.quantity || ""}
                                        onChange={(e) => setNewProduct(p => ({ ...p, quantity: e.target.value }))}
                                        placeholder="0.00"
                                        className="border border-gray-200 bg-blue-50 border-blue-200 rounded-xl px-3 py-2 text-sm text-blue-700
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:bg-white transition"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.rate')}</label>
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={newProduct.rate || ""}
                                        onChange={(e) => setNewProduct(p => ({ ...p, rate: e.target.value }))}
                                        placeholder="₹0.00"
                                        className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2 text-sm text-amber-700
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-200 focus:bg-white transition"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.mrp')}</label>
                                    <input
                                        type="number" step="0.01" min="0"
                                        value={newProduct.mrp_rate || ""}
                                        onChange={(e) => setNewProduct(p => ({ ...p, mrp_rate: e.target.value }))}
                                        placeholder="₹0.00"
                                        className="border border-violet-200 bg-violet-50 rounded-xl px-3 py-2 text-sm text-violet-700
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:bg-white transition"
                                    />
                                </div>
                            </div>

                            {/* Computed total preview */}
                            {newProduct.quantity && newProduct.rate && (
                                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <span className="text-xs text-emerald-600 font-medium">{t('productPurchase.totalAmount')}</span>
                                    <span className="text-sm font-bold text-emerald-700">
                                        ₹{(parseFloat(newProduct.quantity || 0) * parseFloat(newProduct.rate || 0)).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            <div className="flex gap-2 mt-1">
                                <button type="button" onClick={() => setShowNewProduct(false)}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    {t('productPurchase.cancel')}
                                </button>
                                <button type="submit" disabled={savingProduct}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
                                    {savingProduct && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {savingProduct ? t('productPurchase.saving') : t('productPurchase.addProduct')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Purchase Modal */}
            {editingPurchase && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[380px] flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-gray-800 font-semibold text-base">{t('productPurchase.editPurchase') || "Edit Purchase"}</h2>
                                <p className="text-gray-400 text-xs mt-0.5">{t('productPurchase.editPurchaseDesc') || "Stock will be adjusted by the difference."}</p>
                            </div>
                            <button onClick={() => setEditingPurchase(null)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>

                        <div className="flex flex-col gap-3">

                            {/* Product Name — read only */}
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</label>
                                <input
                                    value={editingPurchase.product_name}
                                    onChange={e => setEditingPurchase(p => ({ ...p, product_name: e.target.value }))}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-black transition"
                                />
                            </div>

                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.supplier')}</label>
                                <input value={editingPurchase.supplier_name}
                                    onChange={e => setEditingPurchase(p => ({ ...p, supplier_name: e.target.value }))}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black transition" />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.quantity')}</label>
                                    <input type="number" step="0.01" value={editingPurchase.quantity}
                                        onChange={e => setEditingPurchase(p => ({ ...p, quantity: e.target.value }))}
                                        className="border border-blue-200 bg-blue-50 rounded-xl px-3 py-2 text-sm text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300 transition" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.rate')}</label>
                                    <input type="number" step="0.01" value={editingPurchase.rate}
                                        onChange={e => setEditingPurchase(p => ({ ...p, rate: e.target.value }))}
                                        className="border border-amber-200 bg-amber-50 rounded-xl px-3 py-2 text-sm text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200 transition" />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('productPurchase.mrp')}</label>
                                    <input type="number" step="0.01" value={editingPurchase.mrp_rate}
                                        onChange={e => setEditingPurchase(p => ({ ...p, mrp_rate: e.target.value }))}
                                        className="border border-violet-200 bg-violet-50 rounded-xl px-3 py-2 text-sm text-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-200 transition" />
                                </div>
                            </div>

                            {editingPurchase.quantity && editingPurchase.rate && (
                                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                    <span className="text-xs text-emerald-600 font-medium">{t('productPurchase.total')}</span>
                                    <span className="text-sm font-bold text-emerald-700">
                                        ₹{(parseFloat(editingPurchase.quantity || 0) * parseFloat(editingPurchase.rate || 0)).toFixed(2)}
                                    </span>
                                </div>
                            )}

                            <div className="flex gap-2 mt-1">
                                <button onClick={() => setEditingPurchase(null)}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                    {t('productPurchase.cancel')}
                                </button>
                                <button onClick={handleEditSave} disabled={editSaving}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50 transition flex items-center justify-center gap-2">
                                    {editSaving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {editSaving ? t('productPurchase.saving') : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}