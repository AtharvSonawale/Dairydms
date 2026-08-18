import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
    Package, Save, Plus, AlertTriangle, BadgeCheck,
    RefreshCw, X, Pencil, Check, Layers, Hash,
    TrendingUp, TrendingDown, Search, Archive, IndianRupee,
    Home, Settings
} from "lucide-react";
import api from "../../api/axios";
import { usePermission } from '../../context/PermissionContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import AccessDenied from '../../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const fmtStock = (v) => parseFloat(v || 0).toFixed(2);
const fmtCurrency = (v) => v ? `₹${fmtStock(v)}` : "-";

const EMPTY_NEW = {
    product_name: "",
    unit: "",
    supplier_name: "",
    rate: "",
    mrp_rate: "",
    current_stock: ""
};

function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
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
            className={`border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm
                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                placeholder:text-gray-300 ${className}`}
        />
    );
}

// ── Inline Edit Row ───────────────────────────────────────────
function ProductRow({ product, onSave, onDelete, t, can }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState({
        product_name: product.product_name,
        unit: product.unit,
        current_stock: fmtStock(product.current_stock),
        supplier_name: product.supplier_name || "",
        rate: product.rate ? fmtStock(product.rate) : "",
        mrp_rate: product.mrp_rate ? fmtStock(product.mrp_rate) : "",
    });
    const [saving, setSaving] = useState(false);
    const nameRef = useRef(null);

    const startEdit = () => {
        setDraft({
            product_name: product.product_name,
            unit: product.unit,
            current_stock: fmtStock(product.current_stock),
            supplier_name: product.supplier_name || "",
            rate: product.rate ? fmtStock(product.rate) : "",
            mrp_rate: product.mrp_rate ? fmtStock(product.mrp_rate) : "",
        });
        setEditing(true);
        setTimeout(() => nameRef.current?.focus(), 50);
    };

    const cancelEdit = () => setEditing(false);

    const handleSave = async () => {
        if (!draft.product_name.trim()) return;
        if (!draft.unit.trim()) return;
        setSaving(true);
        await onSave(product.product_id, {
            product_name: draft.product_name.trim(),
            unit: draft.unit.trim(),
            current_stock: parseFloat(draft.current_stock) || 0,
            supplier_name: draft.supplier_name.trim() || null,
            rate: parseFloat(draft.rate) || null,
            mrp_rate: parseFloat(draft.mrp_rate) || null,
        });
        setSaving(false);
        setEditing(false);
    };

    const stockVal = parseFloat(product.current_stock || 0);
    const stockColor =
        stockVal <= 0
            ? "text-rose-500 bg-rose-50/80 border-rose-200/60"
            : stockVal < 5
                ? "text-amber-600 bg-amber-50/80 border-amber-200/60"
                : "text-emerald-600 bg-emerald-50/80 border-emerald-200/60";

    const GRID = "2fr 1fr 120px 150px 100px 100px 90px 90px 50px";

    return (
        <div
            className={`grid border-b border-gray-100/60 transition-colors min-w-max ${editing ? "bg-blue-50/20" : "hover:bg-blue-50/30"}`}
            style={{ gridTemplateColumns: GRID }}
        >
            {/* Product Name */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {editing ? (
                    <input
                        ref={nameRef}
                        value={draft.product_name}
                        onChange={(e) => setDraft((d) => ({ ...d, product_name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                        className="w-full border border-blue-300/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                    />
                ) : (
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shrink-0 shadow-sm">
                            <Package size={14} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800">{product.product_name}</p>
                            <p className="text-[10px] text-gray-400 font-mono">ID #{product.product_id}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Unit */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {editing ? (
                    <input
                        value={draft.unit}
                        onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                        placeholder="kg, bag..."
                        className="w-full border border-blue-300/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                    />
                ) : (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100/80 text-gray-700 text-xs font-semibold font-mono border border-gray-200/60 backdrop-blur-sm">
                        {product.unit}
                    </span>
                )}
            </div>

            {/* Stock */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {editing ? (
                    <div className="flex items-center gap-1.5 w-full">
                        <input
                            value={draft.current_stock}
                            onChange={(e) => setDraft((d) => ({ ...d, current_stock: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                            type="number" step="0.01" placeholder="0.00"
                            className="w-full border border-blue-300/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                        <span className="text-xs text-gray-400 whitespace-nowrap">{draft.unit || product.unit}</span>
                    </div>
                ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-bold font-mono backdrop-blur-sm ${stockColor}`}>
                        {fmtStock(product.current_stock)}
                        <span className="font-normal text-[10px]">{product.unit}</span>
                    </span>
                )}
            </div>

            {/* Supplier */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {editing ? (
                    <input
                        value={draft.supplier_name}
                        onChange={(e) => setDraft((d) => ({ ...d, supplier_name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                        placeholder={t('products.supplierPlaceholder')}
                        className="w-full border border-blue-300/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm
                            focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                    />
                ) : (
                    <span className="text-sm text-gray-700">{product.supplier_name || "-"}</span>
                )}
            </div>

            {/* Rate */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {editing ? (
                    <div className="flex items-center gap-1 w-full">
                        <IndianRupee size={12} className="text-gray-400" />
                        <input
                            value={draft.rate}
                            onChange={(e) => setDraft((d) => ({ ...d, rate: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                            type="number" step="0.01" placeholder="0.00"
                            className="w-full border border-blue-300/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                    </div>
                ) : (
                    <span className="text-sm font-mono text-gray-700">{fmtCurrency(product.rate)}</span>
                )}
            </div>

            {/* MRP */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {editing ? (
                    <div className="flex items-center gap-1 w-full">
                        <IndianRupee size={12} className="text-gray-400" />
                        <input
                            value={draft.mrp_rate}
                            onChange={(e) => setDraft((d) => ({ ...d, mrp_rate: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") cancelEdit(); }}
                            type="number" step="0.01" placeholder="0.00"
                            className="w-full border border-blue-300/60 bg-white/50 backdrop-blur-sm rounded-lg px-3 py-1.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                    </div>
                ) : (
                    <span className="text-sm font-mono text-gray-700">{fmtCurrency(product.mrp_rate)}</span>
                )}
            </div>

            {/* Status */}
            <div className="px-4 py-3 flex items-center border-r border-gray-100/60">
                {stockVal <= 0 ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-rose-500">
                        <TrendingDown size={11} /> {t('products.out')}
                    </span>
                ) : stockVal < 5 ? (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-500">
                        <AlertTriangle size={11} /> {t('products.low')}
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-500">
                        <TrendingUp size={11} /> {t('products.ok')}
                    </span>
                )}
            </div>

            {/* Edit / Save / Cancel */}
            <div className="px-3 py-3 flex items-center gap-1.5 border-r border-gray-100/60">
                {can('products', 'U') && (editing ? (
                    <>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-br from-gray-900 to-gray-800 text-white text-xs font-semibold shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Check size={12} />}
                            {saving ? t('products.saving') : t('products.save')}
                        </button>
                        <button
                            onClick={cancelEdit}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100/80 transition backdrop-blur-sm"
                        >
                            <X size={14} />
                        </button>
                    </>
                ) : (
                    <button
                        onClick={startEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-800 transition shadow-sm"
                    >
                        <Pencil size={12} /> {t('products.edit')}
                    </button>
                ))}
            </div>

            {/* Delete */}
            <div className="px-3 py-3 flex items-center">
                {!editing && can('products', 'D') && (
                    <button
                        onClick={() => onDelete(product)}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-rose-500 hover:bg-rose-50/80 transition backdrop-blur-sm"
                        title={t('products.removeProduct')}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function Products() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [showAdd, setShowAdd] = useState(false);
    const [newProduct, setNewProduct] = useState(EMPTY_NEW);
    const [savingNew, setSavingNew] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startProductsTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="product-actions"]',
                    popover: { title: t('products.addProduct'), description: 'Search existing products or add a new one to your inventory.' },
                },
                {
                    element: '[data-tour="product-stats"]',
                    popover: { title: t('products.totalProducts'), description: 'View total products, low stock alerts, out-of-stock count, and overall stock quantity.' },
                },
                {
                    element: '[data-tour="products-table"]',
                    popover: { title: t('products.actions'), description: 'Click Edit on any row to update product details inline. Use the × button to remove a product.' },
                },
            ],
        });
        driverObj.drive();
    };

    // fetch
    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/products");
            setProducts(data);
        } catch {
            showFlash("error", t('products.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProducts(); }, [t]);

    // filter
    const filtered = search.trim()
        ? products.filter(
            (p) =>
                p.product_name.toLowerCase().includes(search.toLowerCase()) ||
                p.unit.toLowerCase().includes(search.toLowerCase()) ||
                (p.supplier_name && p.supplier_name.toLowerCase().includes(search.toLowerCase())) ||
                String(p.product_id).includes(search.trim())
        )
        : products;

    // add new product
    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newProduct.product_name.trim() || !newProduct.unit.trim()) return;
        setSavingNew(true);
        try {
            await api.post("/products", {
                product_name: newProduct.product_name.trim(),
                unit: newProduct.unit.trim(),
                supplier_name: newProduct.supplier_name.trim() || null,
                rate: parseFloat(newProduct.rate) || null,
                mrp_rate: parseFloat(newProduct.mrp_rate) || null,
                current_stock: parseFloat(newProduct.current_stock) || 0,
            });
            await fetchProducts();
            setNewProduct(EMPTY_NEW);
            setShowAdd(false);
            showFlash("success", t('products.addSuccess', { name: newProduct.product_name.trim() }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('products.addError'));
        } finally {
            setSavingNew(false);
        }
    };

    // inline save (edit)
    const handleSave = async (productId, payload) => {
        try {
            await api.put(`/products/${productId}`, payload);
            await fetchProducts();
            showFlash("success", t('products.updateSuccess'));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('products.updateError'));
        }
    };

    // delete
    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/products/${deleteTarget.product_id}`);
            await fetchProducts();
            showFlash("success", t('products.deleteSuccess', { name: deleteTarget.product_name }));
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('products.deleteError'));
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    // stats
    const totalProducts = products.length;
    const outOfStock = products.filter((p) => parseFloat(p.current_stock || 0) <= 0).length;
    const lowStock = products.filter((p) => {
        const s = parseFloat(p.current_stock || 0);
        return s > 0 && s < 5;
    }).length;
    const totalStock = products.reduce((a, p) => a + parseFloat(p.current_stock || 0), 0);

    const COLS = [
        t('products.productName'), t('products.unit'), t('products.stock'),
        t('products.supplier'), t('products.rate'), t('products.mrp'),
        t('products.status'), t('products.actions'), ""
    ];
    const GRID = "2fr 1fr 120px 150px 100px 100px 90px 90px 50px";

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('products', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('products.pageBreadcrumb', { defaultValue: 'Inventory' })}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('products.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('products.pageSubtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2" data-tour="product-actions">
                        <button
                            onClick={startProductsTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> Take a Tour
                        </button>
                        {can('products', 'C') && (
                            <button
                                onClick={() => { setShowAdd(true); setNewProduct(EMPTY_NEW); }}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 active:scale-95"
                            >
                                <Plus size={16} /> {t('products.addProduct')}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" data-tour="product-stats">
                    {[
                        { label: t('products.totalProducts'), value: totalProducts, icon: <Package size={16} />, color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700" },
                        { label: t('products.lowStock'), value: lowStock, icon: <AlertTriangle size={16} />, color: "from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700" },
                        { label: t('products.outOfStock'), value: outOfStock, icon: <TrendingDown size={16} />, color: "from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600" },
                        { label: t('products.totalStock'), value: totalStock.toFixed(1), icon: <Layers size={16} />, color: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700" },
                    ].map(({ label, value, icon, color }) => (
                        <div key={label} className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-4 flex items-center gap-3`}>
                            <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-white/20 blur-2xl" />
                            <div className="shrink-0 relative z-10 opacity-70">{icon}</div>
                            <div className="relative z-10">
                                <p className="text-xs font-semibold uppercase tracking-wider opacity-60">{label}</p>
                                <p className="text-2xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success"
                            ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Search + Table ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden" data-tour="products-table">

                    {/* Search bar */}
                    <div className="px-5 py-3.5 border-b border-gray-200/60 flex items-center gap-3 bg-gradient-to-r from-gray-50/50 to-white/50">
                        <Search size={15} className="text-gray-400 shrink-0" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={t('products.searchPlaceholder')}
                            className="flex-1 text-sm text-gray-800 bg-transparent placeholder:text-gray-300
                                focus:outline-none"
                        />
                        {search && (
                            <button onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 transition">
                                <X size={14} />
                            </button>
                        )}
                        <span className="text-[11px] text-gray-400 font-medium shrink-0">
                            {filtered.length} {t('products.of')} {products.length}
                        </span>
                    </div>

                    {/* Scrollable table area */}
                    <div className="overflow-x-auto">
                        {/* Table header */}
                        <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50 min-w-max" style={{ gridTemplateColumns: GRID }}>
                            {COLS.map((label) => (
                                <div key={label} className="px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
                                    {label}
                                </div>
                            ))}
                        </div>

                        {/* Rows */}
                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                                <Package size={40} className="text-gray-200" />
                                <p className="text-sm font-medium">
                                    {search ? t('products.noMatch') : t('products.noProducts')}
                                </p>
                                {!search && (
                                    <button
                                        onClick={() => setShowAdd(true)}
                                        className="mt-2 flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:text-gray-700 hover:bg-gray-50/50 transition"
                                    >
                                        <Plus size={14} /> {t('products.addFirstProduct')}
                                    </button>
                                )}
                            </div>
                        ) : (
                            filtered.map((p) => (
                                <ProductRow
                                    key={p.product_id}
                                    product={p}
                                    onSave={handleSave}
                                    onDelete={setDeleteTarget}
                                    t={t}
                                    can={can}
                                />
                            ))
                        )}

                        {/* Footer summary */}
                        {filtered.length > 0 && (
                            <div className="grid border-t-2 border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50 min-w-max" style={{ gridTemplateColumns: GRID }}>
                                <div className="px-4 py-2.5 text-xs font-bold text-gray-600 border-r border-gray-200/60">
                                    {filtered.length} {filtered.length === 1 ? t('products.product') : t('products.products')}
                                </div>
                                <div className="px-4 py-2.5 border-r border-gray-200/60" />
                                <div className="px-4 py-2.5 text-xs font-bold text-emerald-600 border-r border-gray-200/60">
                                    {filtered.reduce((a, p) => a + parseFloat(p.current_stock || 0), 0).toFixed(1)} {t('products.total')}
                                </div>
                                <div className="px-4 py-2.5 border-r border-gray-200/60" />
                                <div className="px-4 py-2.5 border-r border-gray-200/60" />
                                <div className="px-4 py-2.5 border-r border-gray-200/60" />
                                <div className="px-4 py-2.5 border-r border-gray-200/60" />
                                <div className="px-4 py-2.5 border-r border-gray-200/60" />
                                <div className="px-4 py-2.5" />
                            </div>
                        )}
                    </div>{/* end scrollable */}
                </div>

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>• {t('products.legendClickEdit')}</span>
                    <span>• <strong className="text-amber-500">{t('products.low')}</strong> = {t('products.lowDesc')} · <strong className="text-rose-500">{t('products.out')}</strong> = {t('products.outDesc')}</span>
                    <span>• {t('products.legendStockUpdate')}</span>
                    <span>· {t('products.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                </div>

            </main>

            {/* ── Add Product Modal ── */}
            {showAdd && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-96 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-gray-800 font-bold text-base">{t('products.addNewProduct')}</h2>
                                <p className="text-gray-500 text-xs mt-0.5">{t('products.addDesc')}</p>
                            </div>
                            <button
                                onClick={() => setShowAdd(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleAdd} className="flex flex-col gap-3">
                            <Field label={t('products.productNameRequired')} icon={<Package size={12} />}>
                                <input
                                    value={newProduct.product_name}
                                    onChange={(e) => setNewProduct((p) => ({ ...p, product_name: e.target.value }))}
                                    placeholder={t('products.productNamePlaceholder')}
                                    required autoFocus
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('products.unitRequired')} icon={<Hash size={12} />}>
                                    <input
                                        value={newProduct.unit}
                                        onChange={(e) => setNewProduct((p) => ({ ...p, unit: e.target.value }))}
                                        placeholder={t('products.unitPlaceholder')}
                                        required
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    />
                                </Field>
                                <Field label={t('products.currentStock')} icon={<Layers size={12} />}>
                                    <input
                                        value={newProduct.current_stock || ""}
                                        onChange={(e) => setNewProduct((p) => ({ ...p, current_stock: e.target.value }))}
                                        type="number" step="0.01" placeholder="0.00"
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    />
                                </Field>
                            </div>

                            <Field label={t('products.supplierName')} icon={<Package size={12} />}>
                                <input
                                    value={newProduct.supplier_name}
                                    onChange={(e) => setNewProduct((p) => ({ ...p, supplier_name: e.target.value }))}
                                    placeholder={t('products.supplierPlaceholder')}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                />
                            </Field>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label={t('products.purchaseRate')} icon={<IndianRupee size={12} />}>
                                    <input
                                        value={newProduct.rate}
                                        onChange={(e) => setNewProduct((p) => ({ ...p, rate: e.target.value }))}
                                        type="number" step="0.01" placeholder="0.00"
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    />
                                </Field>
                                <Field label={t('products.mrp')} icon={<IndianRupee size={12} />}>
                                    <input
                                        value={newProduct.mrp_rate}
                                        onChange={(e) => setNewProduct((p) => ({ ...p, mrp_rate: e.target.value }))}
                                        type="number" step="0.01" placeholder="0.00"
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    />
                                </Field>
                            </div>

                            <div className="flex gap-2 mt-1 border-t border-gray-100/60 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowAdd(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('products.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingNew}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {savingNew && (
                                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    )}
                                    {savingNew ? t('products.adding') : t('products.addProduct')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Confirm Modal ── */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                        <div className="w-12 h-12 rounded-xl bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shadow-sm">
                            <AlertTriangle size={20} className="text-rose-500" />
                        </div>
                        <div>
                            <h2 className="text-gray-800 font-bold text-base">{t('products.removeProduct')}</h2>
                            <p className="text-gray-500 text-sm mt-1">
                                {t('products.deleteWarning')} <span className="font-semibold text-gray-700">"{deleteTarget.product_name}"</span> {t('products.permanentlyRemoved')}
                            </p>
                            {parseFloat(deleteTarget.current_stock || 0) > 0 && (
                                <p className="text-amber-600 text-xs font-semibold mt-2 bg-amber-50/80 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-amber-200/60 shadow-sm">
                                    ⚠ {t('products.stockWarning', { stock: fmtStock(deleteTarget.current_stock), unit: deleteTarget.unit })}
                                </p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                            >
                                {t('products.cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {deleting && (
                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                )}
                                {deleting ? t('products.removing') : t('products.yesRemove')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}