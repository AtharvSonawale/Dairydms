import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import {
    Droplets, Save, Sun, Moon, FlaskConical, Waves,
    User, AlertTriangle, BadgeCheck, X,
    TrendingUp, Milk, Trash2, Scale,
    Pencil, ShoppingCart, Package, Plug, Home, RotateCcw,
    ChevronDown, PlugZap, Radio, Calendar, Settings, Download
} from "lucide-react";
import api from "../api/axios";
import { useAuth } from "../context/AuthContext";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { useAppConfig } from '../context/AppConfigContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { io } from "socket.io-client";

// ── helpers ───────────────────────────────────────────────────
const getShiftByTime = () => {
    const h = new Date().getHours();
    return h >= 5 && h < 14 ? "morning" : "evening";
};

const today = () => new Date().toISOString().split("T")[0];

const fmtTime = (d) =>
    d ? new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—";

const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const waterRisk = (v) => parseFloat(v) > 5;

const roundWeightToOneDecimal = (v) => {
    const num = parseFloat(v);
    if (isNaN(num)) return "";
    const sign = num < 0 ? -1 : 1;
    const absNum = Math.abs(num);
    const scaled = Math.round(absNum * 100);
    const tens = Math.floor(scaled / 10);
    const remainder = scaled % 10;
    const roundedTens = remainder > 5 ? tens + 1 : tens;
    return ((sign * roundedTens) / 10).toFixed(1);
};

const SNF_THRESHOLD = { cow: 8.2, buffalo: 8.8 };
const FIXED_AUTOFILL_SNF = "8.5";
const snfBelowThreshold = (v, milk_type) =>
    v !== "" && !isNaN(parseFloat(v)) && parseFloat(v) < (SNF_THRESHOLD[milk_type] ?? SNF_THRESHOLD.cow);
const snfAboveThreshold = (v, milk_type) =>
    v !== "" && !isNaN(parseFloat(v)) && parseFloat(v) >= (SNF_THRESHOLD[milk_type] ?? SNF_THRESHOLD.cow);

const getEmptyForm = (sellerType) => ({
    seller_id: "",
    seller_type: sellerType,
    shift: getShiftByTime(),
    milk_type: "cow",
    quantity: "",
    fat: "",
    snf: "",
    water: "",
    protein: "",
    rate_applied: "",
});

const FAT_LIMITS = {
    cow: { min: 2.5, max: 5 },
    buffalo: { min: 2.5, max: 10 },
};
const SNF_LIMITS = {
    cow: { min: 6.5, max: 8.5 },
    buffalo: { min: 6.5, max: 9.0 },
};

const isValidFat = (v, milk_type) => {
    const { min, max } = FAT_LIMITS[milk_type] || FAT_LIMITS.cow;
    return parseFloat(v) >= min && parseFloat(v) <= max;
};

const isValidSnf = (v, milk_type) => {
    const { min } = SNF_LIMITS[milk_type] || SNF_LIMITS.cow;
    return parseFloat(v) >= min;
};

const capSnfForRate = (v, milk_type) => {
    const { max } = SNF_LIMITS[milk_type] || SNF_LIMITS.cow;
    const num = parseFloat(v);
    if (isNaN(num)) return v;
    return Math.min(num, max).toFixed(2);
};

const sellerLabel = (seller) =>
    seller?.seller_code ? `${seller.seller_code} - ${seller.name}` : (seller?.name || "");

function focusNextField(current) {
    const container = current?.closest('[data-entry-form]');
    if (!container) return;
    const focusable = Array.from(
        container.querySelectorAll('input, button, select, textarea')
    ).filter(el => !el.disabled && el.tabIndex !== -1 && el.offsetParent !== null);
    const idx = focusable.indexOf(current);
    if (idx > -1 && idx < focusable.length - 1) {
        focusable[idx + 1].focus();
    }
}

// ── theme (per seller type) ─────────────────────────────────────
const THEME = {
    Utpadak: {
        badge: "bg-emerald-50/80 border-emerald-200/60 text-emerald-700",
        headerIcon: "bg-gradient-to-br from-emerald-500 to-emerald-600",
        accentText: "text-emerald-600",
        bgGrad: "from-emerald-50/80 to-emerald-100/50",
    },
    Gavali: {
        badge: "bg-orange-50/80 border-orange-200/60 text-orange-700",
        headerIcon: "bg-gradient-to-br from-orange-500 to-orange-600",
        accentText: "text-orange-600",
        bgGrad: "from-orange-50/80 to-orange-100/50",
    },
};

// ── sub-components ────────────────────────────────────────────
function Field({ label, icon, children, ...rest }) {
    return (
        <div className="flex flex-col gap-0.5 shrink-0" {...rest}>
            <span className="flex items-center gap-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {icon}{label}
            </span>
            {children}
        </div>
    );
}

const TinyInput = React.forwardRef(function TinyInput({ className = "", style = {}, ...props }, ref) {
    const focusBg = props.readOnly ? "focus:bg-transparent" : "focus:bg-white";
    return (
        <input
            ref={ref}
            {...props}
            style={{ minWidth: 0, ...style }}
            className={`border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-[15px] text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 ${focusBg} transition placeholder:text-gray-300 ${className}`}
        />
    );
});

function ShiftToggle({ value, onChange, t }) {
    return (
        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-sm font-bold shadow-sm">
            {["morning", "evening"].map((s) => (
                <button key={s} type="button" onClick={() => onChange(s)}
                    title={s === "morning" ? t('milkEntry.morning') : t('milkEntry.evening')}
                    className={`flex items-center justify-center px-3 py-2 transition-all duration-200
                        ${value === s
                            ? s === "morning"
                                ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30"
                                : "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                            : "bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80"}`}>
                    {s === "morning" ? <Sun size={15} /> : <Moon size={15} />}
                </button>
            ))}
        </div>
    );
}

function MilkTypeToggle({ value, onChange, t, disabled }) {
    return (
        <div className={`flex rounded-xl border border-gray-200/60 overflow-hidden text-sm font-bold shadow-sm ${disabled ? "opacity-50" : ""}`}>
            {[
                { val: "cow", label: t('milkEntry.cow'), active: "bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30" },
                { val: "buffalo", label: t('milkEntry.buffalo'), active: "bg-gradient-to-br from-slate-700 to-slate-800 text-white shadow-lg shadow-slate-700/30" },
            ].map(({ val, label, active }) => (
                <button key={val} type="button" disabled={disabled} onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-2 transition-all duration-200
                        ${disabled ? "cursor-not-allowed" : ""}
                        ${value === val ? active : "bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80"}`}>
                    {label}
                </button>
            ))}
        </div>
    );
}

function SellerTypeToggle({ value, onChange }) {
    return (
        <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-sm font-bold shadow-sm">
            {[
                { val: "Utpadak", active: "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30" },
                { val: "Gavali", active: "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30" },
            ].map(({ val, active }) => (
                <button key={val} type="button" onClick={() => onChange(val)}
                    className={`flex items-center gap-1.5 px-3 py-2 transition-all duration-200
                        ${value === val ? active : "bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80"}`}>
                    {val}
                </button>
            ))}
        </div>
    );
}

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-3 flex items-center border-r border-gray-100/60 last:border-r-0 text-[15px] ${className}`}>
            {children}
        </div>
    );
}

function DigitReadout({ label, value, unit, connected, accent, primary, width }) {
    const accents = {
        emerald: { box: "bg-emerald-50/70 backdrop-blur-sm border-emerald-200/60", label: "text-emerald-600/80" },
        amber: { box: "bg-amber-50/70 backdrop-blur-sm border-amber-200/60", label: "text-amber-600/80" },
        rose: { box: "bg-rose-50/70 backdrop-blur-sm border-rose-200/60", label: "text-rose-600/80" },
    }[accent];

    const len = (value || "").length;
    const primarySize = len >= 8 ? "1.65rem" : len >= 7 ? "1.85rem" : len >= 6 ? "2.15rem" : len >= 5 ? "2.4rem" : "2.7rem";
    const secondarySize = len >= 7 ? "1.05rem" : len >= 6 ? "1.2rem" : len >= 5 ? "1.35rem" : "1.55rem";

    const opacityClass = connected ? "opacity-100" : "opacity-40";

    return (
        <div className="flex flex-col items-center gap-0.5 flex-1" style={width ? { minWidth: width } : undefined}>
            <span className={`text-[9px] font-bold uppercase tracking-[0.15em] ${accents.label}`}>{label}</span>
            <div className={`w-full rounded-xl border ${accents.box} ${primary ? "px-3 py-1.5" : "px-2 py-1"} flex items-baseline justify-center gap-1 shadow-sm`}
                style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.08)" }}>
                <span
                    className={`font-mono font-bold tabular-nums leading-none whitespace-nowrap text-gray-900 ${opacityClass}`}
                    style={{ fontSize: primary ? primarySize : secondarySize, letterSpacing: "-0.02em" }}
                >
                    {value && value !== "" ? value : "—.—"}
                </span>
                {unit ? (
                    <span className={`font-mono font-bold uppercase ${primary ? "text-[11px]" : "text-[10px]"} text-gray-600 ${opacityClass}`}>
                        {unit}
                    </span>
                ) : null}
            </div>
        </div>
    );
}

function ConnectionPill({ connected, label }) {
    return (
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border backdrop-blur-sm shadow-sm
            ${connected ? "bg-emerald-50/80 border-emerald-300/60 text-emerald-700" : "bg-gray-100/80 border-gray-200/60 text-gray-400"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
            {connected ? label || "Live" : "Offline"}
        </span>
    );
}

function StatCard({ label, value, icon, color }) {
    return (
        <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${color} shadow-sm p-3 flex items-center gap-2.5`}>
            <div className="absolute -right-6 -top-6 w-16 h-16 rounded-full bg-white/20 blur-2xl" />
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center relative z-10">
                {icon}
            </div>
            <div className="relative z-10 min-w-0">
                <p className="text-[10.5px] font-semibold uppercase tracking-wider opacity-60 leading-none truncate">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-1 truncate">{value}</p>
            </div>
        </div>
    );
}

// ── Quick Sale Modal: Products ──────────────────────────────
function QuickProductSaleModal({ sellerId, sellerName, saleDate, onClose, onSuccess, showFlash }) {
    const [products, setProducts] = useState([]);
    const [lines, setLines] = useState([{ _key: Date.now(), product_id: "", quantity: "", rate: "" }]);
    const [productSearch, setProductSearch] = useState({});
    const [showProductDrop, setShowProductDrop] = useState({});
    const productInputRefs = useRef({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get("/products")
            .then(({ data }) => setProducts(data))
            .catch(() => showFlash("error", "Failed to load products"));
    }, []);

    const setLine = (key, field, value) =>
        setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));

    const addLine = () =>
        setLines(prev => [...prev, { _key: Date.now() + Math.random(), product_id: "", quantity: "", rate: "" }]);

    const removeLine = (key) =>
        setLines(prev => prev.length > 1 ? prev.filter(l => l._key !== key) : prev);

    const grandTotal = lines.reduce((sum, l) => {
        const qty = parseFloat(l.quantity) || 0;
        const rate = parseFloat(l.rate) || 0;
        return sum + qty * rate;
    }, 0);

    const handleSave = async () => {
        const validLines = lines.filter(l => l.product_id && l.quantity && l.rate);
        if (validLines.length === 0) {
            showFlash("error", "Add at least one product with quantity and rate.");
            return;
        }
        if (saving) return;
        setSaving(true);
        try {
            await api.post("/product-sales", {
                seller_id: Number(sellerId),
                sale_date: saleDate,
                lines: validLines.map(l => ({
                    product_id: Number(l.product_id),
                    quantity: parseFloat(l.quantity),
                    rate: parseFloat(l.rate),
                })),
            });
            showFlash("success", "Product sale recorded successfully!");
            onSuccess?.();
            onClose();
        } catch (err) {
            const msg = err.response?.data?.error || "Failed to save product sale.";
            showFlash("error", msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-blue-50/50 to-white/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 shrink-0">
                            <ShoppingCart size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Quick Product Sale</h2>
                            <p className="text-[11px] text-gray-500">
                                Seller: <span className="font-semibold text-gray-700">{sellerName || `ID:${sellerId}`}</span>
                                {" · "}{new Date(saleDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="flex flex-col gap-3">
                        <div className="grid gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1"
                            style={{ gridTemplateColumns: "minmax(0, 1fr) 80px 80px 90px 28px" }}>
                            <span>Product</span>
                            <span>Qty</span>
                            <span>Rate</span>
                            <span>Total</span>
                            <span />
                        </div>

                        {lines.map((line) => {
                            const lineProduct = products.find(p => String(p.product_id) === String(line.product_id));
                            const lt = (parseFloat(line.quantity) || 0) * (parseFloat(line.rate) || 0);
                            const searchVal = productSearch[line._key] !== undefined ? productSearch[line._key] : (lineProduct?.product_name || "");

                            return (
                                <div key={line._key} className="grid gap-2 items-start"
                                    style={{ gridTemplateColumns: "minmax(0, 1fr) 80px 80px 90px 28px" }}>
                                    <div className="relative">
                                        <TinyInput
                                            ref={(el) => { productInputRefs.current[line._key] = el; }}
                                            value={searchVal}
                                            onChange={(e) => {
                                                setProductSearch(p => ({ ...p, [line._key]: e.target.value }));
                                                setShowProductDrop(p => ({ ...p, [line._key]: true }));
                                            }}
                                            onFocus={() => {
                                                setProductSearch(p => ({ ...p, [line._key]: "" }));
                                                setShowProductDrop(p => ({ ...p, [line._key]: true }));
                                            }}
                                            onBlur={() => setTimeout(() => {
                                                setShowProductDrop(p => ({ ...p, [line._key]: false }));
                                                setProductSearch(p => { const n = { ...p }; delete n[line._key]; return n; });
                                            }, 150)}
                                            placeholder="Search product…"
                                            className="w-full"
                                        />
                                        <DropdownPortal
                                            anchorRef={{ current: productInputRefs.current[line._key] }}
                                            open={!!showProductDrop[line._key]}
                                            width={288}
                                        >
                                            {(productSearch[line._key]?.trim()
                                                ? products.filter(p => p.product_name.toLowerCase().includes(productSearch[line._key].toLowerCase()))
                                                : products
                                            ).map((p) => (
                                                <button key={p.product_id} type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setLine(line._key, "product_id", String(p.product_id));
                                                        setLine(line._key, "rate", p.mrp_rate ? String(p.mrp_rate) : (p.rate ? String(p.rate) : ""));
                                                        setProductSearch(prev => { const n = { ...prev }; delete n[line._key]; return n; });
                                                        setShowProductDrop(prev => ({ ...prev, [line._key]: false }));
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 text-left transition">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-800">{p.product_name}</p>
                                                        <p className="text-[10px] text-gray-400">
                                                            Stock: {parseFloat(p.current_stock || 0).toFixed(1)} {p.unit}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] text-violet-600 font-semibold">
                                                        ₹{parseFloat(p.mrp_rate || 0).toFixed(2)}
                                                    </span>
                                                </button>
                                            ))}
                                        </DropdownPortal>
                                    </div>

                                    <TinyInput
                                        value={line.quantity}
                                        onChange={(e) => setLine(line._key, "quantity", e.target.value)}
                                        placeholder="0.0" type="number" step="0.01"
                                        className="w-full bg-blue-50/30 border-blue-200/60 text-blue-700"
                                    />

                                    <TinyInput
                                        value={line.rate}
                                        onChange={(e) => setLine(line._key, "rate", e.target.value)}
                                        placeholder="₹0.00" type="number" step="0.01"
                                        className="w-full bg-amber-50/30 border-amber-200/60 text-amber-700"
                                    />

                                    <div className={`h-[41px] px-2 flex items-center rounded-xl border text-xs font-bold whitespace-nowrap shadow-sm
                                        ${lt ? "bg-emerald-50/80 border-emerald-200/60 text-emerald-700" : "bg-gray-50/80 border-gray-200/60 text-gray-300"}`}>
                                        {lt ? `₹${lt.toFixed(2)}` : "—"}
                                    </div>

                                    <button type="button" onClick={() => removeLine(line._key)}
                                        disabled={lines.length === 1}
                                        className="w-7 h-[41px] flex items-center justify-center rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 disabled:opacity-20 transition border border-rose-200/60 backdrop-blur-sm shadow-sm">
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button type="button" onClick={addLine}
                        className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-dashed border-gray-300/60 hover:border-gray-500 px-3 py-1.5 rounded-xl transition bg-white/50 backdrop-blur-sm shadow-sm">
                        <span className="text-base leading-none">+</span> Add Product
                    </button>
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/60 shrink-0 bg-gray-50/60 rounded-b-2xl">
                    <div className="text-sm font-bold text-gray-800">
                        Grand Total: <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 ${saving ? "bg-gray-300" : "bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40"}`}>
                            {saving ? "Saving…" : "Record Sale"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Quick Sale Modal: Cattle Feed ──────────────────────────────
function QuickFeedSaleModal({ sellerId, sellerName, saleDate, onClose, onSuccess, showFlash }) {
    const [feeds, setFeeds] = useState([]);
    const [lines, setLines] = useState([{ _key: Date.now(), feed_id: "", quantity: "", rate: "" }]);
    const [feedSearch, setFeedSearch] = useState({});
    const [showFeedDrop, setShowFeedDrop] = useState({});
    const feedInputRefs = useRef({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get("/cattle-feeds")
            .then(({ data }) => setFeeds(data))
            .catch(() => showFlash("error", "Failed to load feeds"));
    }, []);

    const setLine = (key, field, value) =>
        setLines(prev => prev.map(l => l._key === key ? { ...l, [field]: value } : l));

    const addLine = () =>
        setLines(prev => [...prev, { _key: Date.now() + Math.random(), feed_id: "", quantity: "", rate: "" }]);

    const removeLine = (key) =>
        setLines(prev => prev.length > 1 ? prev.filter(l => l._key !== key) : prev);

    const grandTotal = lines.reduce((sum, l) => {
        const qty = parseFloat(l.quantity) || 0;
        const rate = parseFloat(l.rate) || 0;
        return sum + qty * rate;
    }, 0);

    const handleSave = async () => {
        const validLines = lines.filter(l => l.feed_id && l.quantity && l.rate);
        if (validLines.length === 0) {
            showFlash("error", "Add at least one feed with quantity and rate.");
            return;
        }
        if (saving) return;
        setSaving(true);
        try {
            await api.post("/cattle-feed-sales", {
                seller_id: Number(sellerId),
                sale_date: saleDate,
                lines: validLines.map(l => ({
                    feed_id: Number(l.feed_id),
                    quantity: parseFloat(l.quantity),
                    rate: parseFloat(l.rate),
                })),
            });
            showFlash("success", "Feed sale recorded successfully!");
            onSuccess?.();
            onClose();
        } catch (err) {
            const msg = err.response?.data?.error || "Failed to save feed sale.";
            showFlash("error", msg);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 shrink-0 bg-gradient-to-r from-emerald-50/50 to-white/50 rounded-t-2xl">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 shrink-0">
                            <Package size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-gray-900">Quick Feed Sale</h2>
                            <p className="text-[11px] text-gray-500">
                                Seller: <span className="font-semibold text-gray-700">{sellerName || `ID:${sellerId}`}</span>
                                {" · "}{new Date(saleDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm">
                        <X size={16} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="flex flex-col gap-3">
                        <div className="grid gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider px-1"
                            style={{ gridTemplateColumns: "minmax(0, 1fr) 80px 80px 90px 28px" }}>
                            <span>Feed</span>
                            <span>Qty</span>
                            <span>Rate</span>
                            <span>Total</span>
                            <span />
                        </div>

                        {lines.map((line) => {
                            const lineFeed = feeds.find(f => String(f.feed_id) === String(line.feed_id));
                            const lt = (parseFloat(line.quantity) || 0) * (parseFloat(line.rate) || 0);
                            const searchVal = feedSearch[line._key] !== undefined ? feedSearch[line._key] : (lineFeed?.feed_name || "");

                            return (
                                <div key={line._key} className="grid gap-2 items-start"
                                    style={{ gridTemplateColumns: "minmax(0, 1fr) 80px 80px 90px 28px" }}>
                                    <div className="relative">
                                        <TinyInput
                                            ref={(el) => { feedInputRefs.current[line._key] = el; }}
                                            value={searchVal}
                                            onChange={(e) => {
                                                setFeedSearch(p => ({ ...p, [line._key]: e.target.value }));
                                                setShowFeedDrop(p => ({ ...p, [line._key]: true }));
                                            }}
                                            onFocus={() => {
                                                setFeedSearch(p => ({ ...p, [line._key]: "" }));
                                                setShowFeedDrop(p => ({ ...p, [line._key]: true }));
                                            }}
                                            onBlur={() => setTimeout(() => {
                                                setShowFeedDrop(p => ({ ...p, [line._key]: false }));
                                                setFeedSearch(p => { const n = { ...p }; delete n[line._key]; return n; });
                                            }, 150)}
                                            placeholder="Search feed…"
                                            className="w-full"
                                        />
                                        <DropdownPortal
                                            anchorRef={{ current: feedInputRefs.current[line._key] }}
                                            open={!!showFeedDrop[line._key]}
                                            width={288}
                                        >
                                            {(feedSearch[line._key]?.trim()
                                                ? feeds.filter(f => f.feed_name.toLowerCase().includes(feedSearch[line._key].toLowerCase()))
                                                : feeds
                                            ).map((f) => (
                                                <button key={f.feed_id} type="button"
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        setLine(line._key, "feed_id", String(f.feed_id));
                                                        setLine(line._key, "rate", f.mrp_rate ? String(f.mrp_rate) : (f.rate ? String(f.rate) : ""));
                                                        setFeedSearch(prev => { const n = { ...prev }; delete n[line._key]; return n; });
                                                        setShowFeedDrop(prev => ({ ...prev, [line._key]: false }));
                                                    }}
                                                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50/80 text-left transition">
                                                    <div>
                                                        <p className="text-xs font-medium text-gray-800">{f.feed_name}</p>
                                                        <p className="text-[10px] text-gray-400">
                                                            Stock: {parseFloat(f.current_stock || 0).toFixed(1)} {f.unit}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] text-violet-600 font-semibold">
                                                        ₹{parseFloat(f.mrp_rate || 0).toFixed(2)}
                                                    </span>
                                                </button>
                                            ))}
                                        </DropdownPortal>
                                    </div>

                                    <TinyInput
                                        value={line.quantity}
                                        onChange={(e) => setLine(line._key, "quantity", e.target.value)}
                                        placeholder="0.0" type="number" step="0.01"
                                        className="w-full bg-blue-50/30 border-blue-200/60 text-blue-700"
                                    />

                                    <TinyInput
                                        value={line.rate}
                                        onChange={(e) => setLine(line._key, "rate", e.target.value)}
                                        placeholder="₹0.00" type="number" step="0.01"
                                        className="w-full bg-amber-50/30 border-amber-200/60 text-amber-700"
                                    />

                                    <div className={`h-[41px] px-2 flex items-center rounded-xl border text-xs font-bold whitespace-nowrap shadow-sm
                                        ${lt ? "bg-emerald-50/80 border-emerald-200/60 text-emerald-700" : "bg-gray-50/80 border-gray-200/60 text-gray-300"}`}>
                                        {lt ? `₹${lt.toFixed(2)}` : "—"}
                                    </div>

                                    <button type="button" onClick={() => removeLine(line._key)}
                                        disabled={lines.length === 1}
                                        className="w-7 h-[41px] flex items-center justify-center rounded-xl bg-rose-50/80 hover:bg-rose-100/80 text-rose-400 disabled:opacity-20 transition border border-rose-200/60 backdrop-blur-sm shadow-sm">
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button type="button" onClick={addLine}
                        className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-dashed border-gray-300/60 hover:border-gray-500 px-3 py-1.5 rounded-xl transition bg-white/50 backdrop-blur-sm shadow-sm">
                        <span className="text-base leading-none">+</span> Add Feed
                    </button>
                </div>

                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200/60 shrink-0 bg-gray-50/60 rounded-b-2xl">
                    <div className="text-sm font-bold text-gray-800">
                        Grand Total: <span className="text-emerald-700">₹{grandTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose}
                            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm">
                            Cancel
                        </button>
                        <button onClick={handleSave} disabled={saving}
                            className={`px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 ${saving ? "bg-gray-300" : "bg-gradient-to-br from-gray-900 to-gray-800 shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40"}`}>
                            {saving ? "Saving…" : "Record Sale"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function DropdownPortal({ anchorRef, open, width, children }) {
    const [coords, setCoords] = useState(null);

    useEffect(() => {
        if (!open || !anchorRef.current) { setCoords(null); return; }
        const update = () => {
            const rect = anchorRef.current.getBoundingClientRect();
            setCoords({
                top: rect.bottom + window.scrollY + 4,
                left: rect.left + window.scrollX,
                width: width || rect.width,
            });
        };
        update();
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [open, anchorRef, width]);

    if (!open || !coords) return null;

    return createPortal(
        <div
            style={{
                position: "absolute",
                top: coords.top,
                left: coords.left,
                width: coords.width,
                backgroundColor: "#ffffff",
                zIndex: 99999,
            }}
            className="border border-gray-200 rounded-xl shadow-2xl overflow-hidden max-h-52 overflow-y-auto"
        >
            {children}
        </div>,
        document.body
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function MilkEntryBase({ sellerType }) {
    const { t } = useTranslation();
    const theme = THEME[sellerType] || THEME.Utpadak;

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [entryToDelete, setEntryToDelete] = useState(null);
    const [form, setForm] = useState(() => getEmptyForm(sellerType));
    const [entries, setEntries] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [sellerSearch, setSellerSearch] = useState("");
    const [sellerCodeInput, setSellerCodeInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(today());
    const [liveStock, setLiveStock] = useState({ cow: 0, buffalo: 0 });
    const [flash, setFlash] = useState(null);
    const [flashPhase, setFlashPhase] = useState('hidden');
    const [currentPage, setCurrentPage] = useState(1);
    const [searchName, setSearchName] = useState("");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const sellerInputRef = useRef(null);
    const sellerCodeRef = useRef(null);
    const [highlightedIdx, setHighlightedIdx] = useState(-1);
    const [editingEntry, setEditingEntry] = useState(null);
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";
    const { appName, fatOnlyAutofill } = useAppConfig();
    const { can, loading: permLoading } = usePermission();
    const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

    const [showProductModal, setShowProductModal] = useState(false);
    const [showFeedModal, setShowFeedModal] = useState(false);

    const [weightBySubtype, setWeightBySubtype] = useState({
        weight_gavali: { qty: "", qty2: "", uom: "", uom2: "", connected: false, raw: "" },
        weight_utpadak: { qty: "", qty2: "", uom: "", uom2: "", connected: false, raw: "" },
        weight: { qty: "", qty2: "", uom: "", uom2: "", connected: false, raw: "" },
    });
    const [weightPortConfig, setWeightPortConfig] = useState({ weight_gavali: null, weight_utpadak: null, weight: null });
    const socketRef = useRef(null);
    const lastAppliedWeightRaw = useRef({ weight_gavali: null, weight_utpadak: null, weight: null });
    const lastAppliedFatRaw = useRef(null);
    const weightPortConfigRef = useRef({ weight_gavali: null, weight_utpadak: null, weight: null });

    // This page is scoped to a single, role-specific seller type — it always
    // reads the matching saved port from Port Settings (weight_gavali or
    // weight_utpadak) and never switches or falls back to the Default Scale.
    const activeWeightKey = sellerType === "Gavali" ? "weight_gavali" : "weight_utpadak";
    const activeWeightSubtypeParam = sellerType === "Gavali" ? "gavali" : "utpadak";
    const activeWeight = weightBySubtype[activeWeightKey];
    const machineQty = activeWeight.qty;
    const machineQty2 = activeWeight.qty2;
    const machineUom = activeWeight.uom;
    const machineUom2 = activeWeight.uom2;
    const isMachineConnected = activeWeight.connected;
    const [machineFat, setMachineFat] = useState("");
    const [machineSnf, setMachineSnf] = useState("");
    const [machineProtein, setMachineProtein] = useState("");
    const [isFatConnected, setIsFatConnected] = useState(false);
    const [lastFatRaw, setLastFatRaw] = useState("");
    const [fatPortConfig, setFatPortConfig] = useState(null);
    const [lastFatUpdateAt, setLastFatUpdateAt] = useState(null);

    // Track if fat/snf was saved to form
    const [fatSavedToForm, setFatSavedToForm] = useState(false);
    const lastSavedFatRaw = useRef(null);

    // Live capture toggles
    const [liveMilkCaptureEnabled, setLiveMilkCaptureEnabled] = useState(false);
    const liveMilkCaptureEnabledRef = useRef(false);
    useEffect(() => { liveMilkCaptureEnabledRef.current = liveMilkCaptureEnabled; }, [liveMilkCaptureEnabled]);

    const [liveFatCaptureEnabled, setLiveFatCaptureEnabled] = useState(false);
    const liveFatCaptureEnabledRef = useRef(false);
    useEffect(() => { liveFatCaptureEnabledRef.current = liveFatCaptureEnabled; }, [liveFatCaptureEnabled]);

    useEffect(() => {
        api.get("/settings/ports")
            .then(({ data }) => {
                setWeightPortConfig({
                    weight_gavali: data?.weight_gavali || null,
                    weight_utpadak: data?.weight_utpadak || null,
                    weight: data?.weight || null,
                });
                setFatPortConfig(data?.fat || null);
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        const resolvedSocketUrl =
            import.meta.env.VITE_SOCKET_URL ||
            api.defaults.baseURL.replace(/\/api\/?$/, "") ||
            "http://localhost:5000";

        const socket = io(resolvedSocketUrl, {
            transports: ["websocket"],
        });
        socketRef.current = socket;

        const handleWeightUpdate = (subtypeKey) => (reading) => {
            setWeightBySubtype(prev => ({
                ...prev,
                [subtypeKey]: {
                    connected: !!reading.connected,
                    qty: reading.value !== null && reading.value !== undefined ? reading.value.toFixed(3) : prev[subtypeKey].qty,
                    qty2: reading.value2 !== null && reading.value2 !== undefined ? reading.value2.toFixed(3) : prev[subtypeKey].qty2,
                    uom: reading.unit || prev[subtypeKey].uom,
                    uom2: reading.unit2 || prev[subtypeKey].uom2,
                    raw: reading.raw || prev[subtypeKey].raw,
                },
            }));
            const unitPref = weightPortConfigRef.current[subtypeKey]?.default_weight_unit || "ltr";
            const fillValue = unitPref === "kg" ? reading.value : reading.value2;

            if (fillValue !== null && fillValue !== undefined) {
                // If live capture is enabled, update form quantity
                if (liveMilkCaptureEnabledRef.current) {
                    const roundedVal = roundWeightToOneDecimal(fillValue);
                    setForm(p => {
                        const expectedKey = sellerType === "Gavali" ? "weight_gavali" : "weight_utpadak";
                        if (subtypeKey !== expectedKey) return p;
                        return { ...p, quantity: roundedVal };
                    });
                }
                setLastUpdateAt(Date.now());
            }
        };

        socket.on("weight:update:gavali", handleWeightUpdate("weight_gavali"));
        socket.on("weight:update:utpadak", handleWeightUpdate("weight_utpadak"));
        socket.on("weight:update:default", handleWeightUpdate("weight"));

        socket.on("fat:update", (reading) => {
            setIsFatConnected(!!reading.connected);

            if (!reading.connected || !reading.raw || reading.raw === lastAppliedFatRaw.current) {
                return;
            }
            lastAppliedFatRaw.current = reading.raw;

            // Always update machine values
            if (reading.fat !== null && reading.fat !== undefined) {
                const fatValue = reading.fat.toFixed(2);
                setMachineFat(fatValue);
                // If live capture is enabled, update form
                if (liveFatCaptureEnabledRef.current) {
                    set("fat", fatValue);
                    fetchAutoRate(fatValue, reading.snf !== null && reading.snf !== undefined ? reading.snf.toFixed(2) : form.snf, form.milk_type);
                }
            }
            if (reading.snf !== null && reading.snf !== undefined) {
                const snfValue = reading.snf.toFixed(2);
                setMachineSnf(snfValue);
                if (liveFatCaptureEnabledRef.current) {
                    set("snf", snfValue);
                }
            }
            if (reading.water !== null && reading.water !== undefined) {
                set("water", reading.water.toFixed(2));
            }
            if (reading.protein !== null && reading.protein !== undefined) {
                const proteinValue = reading.protein.toFixed(2);
                setMachineProtein(proteinValue);
                if (liveFatCaptureEnabledRef.current) {
                    set("protein", proteinValue);
                }
            }
            setLastFatRaw(reading.raw || "");
            setLastFatUpdateAt(Date.now());
        });

        return () => {
            socket.disconnect();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const connectSerialPort = async (subtype, silent = false) => {
        const label = subtype === "gavali" ? "Gavali" : subtype === "utpadak" ? "Utpadak" : "Default";
        if (!silent) showFlash("success", `Connecting to ${label} weight machine…`);
        try {
            const { data } = await api.post(`/settings/ports/weight/${subtype}/connect`);
            showFlash(data.success ? "success" : "error", data.message || (data.success ? "Connected." : "Connection failed."));
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to connect to weight machine.");
        }
    };

    const disconnectMachine = async (subtype) => {
        try {
            await api.post(`/settings/ports/weight/${subtype}/disconnect`);
            showFlash("info", "Disconnected from weight machine.");
        } catch {
            showFlash("error", "Failed to disconnect.");
        }
    };

    const lastAddedMilkRaw = useRef({ weight_gavali: null, weight_utpadak: null, weight: null });

    const addMilkFromScale = () => {
        const val = parseFloat(machineQty2);
        if (!val || val <= 0) {
            showFlash("error", "No valid weight reading on the scale to add.");
            return;
        }
        const currentRaw = activeWeight.raw;
        if (currentRaw && currentRaw === lastAddedMilkRaw.current[activeWeightKey]) {
            showFlash("error", "This reading was already added. Place new milk on the scale first.");
            return;
        }
        lastAddedMilkRaw.current[activeWeightKey] = currentRaw;
        const roundedVal = parseFloat(roundWeightToOneDecimal(val));
        setForm(p => {
            const current = parseFloat(p.quantity) || 0;
            return { ...p, quantity: (current + roundedVal).toFixed(1) };
        });
        showFlash("success", `Added ${roundedVal.toFixed(1)} L to Quantity.`);
    };

    const connectFatPort = async (silent = false) => {
        if (!silent) showFlash("success", "Connecting to Fat & SNF machine…");
        try {
            const { data } = await api.post("/settings/ports/fat/connect");
            showFlash(data.success ? "success" : "error", data.message || (data.success ? "Connected." : "Connection failed."));
        } catch (err) {
            showFlash("error", err.response?.data?.message || "Failed to connect to Fat & SNF machine.");
        }
    };

    const disconnectFatMachine = async () => {
        try {
            await api.post("/settings/ports/fat/disconnect");
            showFlash("info", "Disconnected from Fat & SNF machine.");
        } catch {
            showFlash("error", "Failed to disconnect.");
        }
    };

    const saveFatReadingToForm = () => {
        if (!machineFat && !machineSnf && !machineProtein) {
            showFlash("error", "No Fat/SNF reading available to save yet.");
            return;
        }
        if (lastFatRaw && lastFatRaw === lastSavedFatRaw.current) {
            showFlash("error", "This reading was already saved. Wait for a new reading.");
            return;
        }
        lastSavedFatRaw.current = lastFatRaw;
        setForm(p => ({
            ...p,
            fat: machineFat || p.fat,
            snf: machineSnf || p.snf,
            protein: machineProtein || p.protein,
        }));
        const fatForRate = machineFat || form.fat;
        const snfForRate = machineSnf || form.snf;
        if (fatForRate && snfForRate) fetchAutoRate(fatForRate, snfForRate, form.milk_type);
        setFatSavedToForm(true);
        showFlash("success", `Saved Fat ${machineFat || "—"}% / SNF ${machineSnf || "—"}% to the form.`);
    };

    const autoConnectFired = useRef(false);
    useEffect(() => {
        if (autoConnectFired.current) return;
        autoConnectFired.current = true;
        connectSerialPort(sellerType === "Gavali" ? "gavali" : "utpadak", true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const autoConnectFatFired = useRef(false);
    useEffect(() => {
        if (autoConnectFatFired.current) return;
        autoConnectFatFired.current = true;
        connectFatPort(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [rangeMode, setRangeMode] = useState("daily");
    const [fromDate, setFromDate] = useState(today());
    const [toDate, setToDate] = useState(today());
    const [rangeEntries, setRangeEntries] = useState([]);
    const [loadingRange, setLoadingRange] = useState(false);
    const [pdfReady, setPdfReady] = useState(false);
    const [lastUpdateAt, setLastUpdateAt] = useState(null);

    const [pageSize, setPageSize] = useState(5);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setFlashPhase('visible');
        setTimeout(() => setFlashPhase('hidden'), 3200);
        setTimeout(() => setFlash(null), 3500);
    };

    const dismissFlash = () => {
        setFlashPhase('hidden');
        setFlash(null);
    };

    const amount =
        form.quantity && form.rate_applied
            ? (parseFloat(form.quantity || 0) * parseFloat(form.rate_applied || 0)).toFixed(2)
            : null;

    const fetchSellers = async () => {
        try {
            const { data } = await api.get("/sellers");
            setSellers(data.filter(s => s.seller_type === sellerType));
        } catch { }
    };

    const totalSellers = sellers.length;
    const morningSellers = new Set(entries.filter(e => e.shift === "morning").map(e => e.seller_id));
    const eveningSellers = new Set(entries.filter(e => e.shift === "evening").map(e => e.seller_id));

    const remainingMorningSellers = totalSellers - morningSellers.size;
    const remainingEveningSellers = totalSellers - eveningSellers.size;

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

    const fetchEntries = async (from, to) => {
        setLoading(true);
        try {
            const base = from === to ? `/milk-entries?date=${from}` : `/milk-entries?from=${from}&to=${to}`;
            const url = `${base}&seller_type=${sellerType}`;
            const { data } = await api.get(url);
            setEntries(data);
        } catch {
            showFlash("error", t('milkEntry.loadError'));
        } finally {
            setLoading(false);
        }
    };

    const autoRateTimer = useRef(null);
    const fetchAutoRate = (fat, snf, milk_type) => {
        const snfRaw = fatOnlyAutofill ? FIXED_AUTOFILL_SNF : snf;
        if (!fat || !snfRaw || !milk_type) return;
        if (!isValidFat(fat, milk_type) || !isValidSnf(snfRaw, milk_type)) return;
        const snfForLookup = capSnfForRate(snfRaw, milk_type);
        clearTimeout(autoRateTimer.current);
        autoRateTimer.current = setTimeout(async () => {
            try {
                const { data } = await api.get(
                    `/rates/lookup?fat=${fat}&snf=${snfForLookup}&milk_type=${milk_type}&date=${selectedDate}`
                );
                if (data?.rate) {
                    set("rate_applied", data.rate);
                    showFlash("success", t('milkEntry.rateAutoFilled', { rate: data.rate }));
                }
            } catch { }
        }, 500);
    };

    const fetchPremiumRate = async (seller_id, milk_type, date) => {
        if (!seller_id || !milk_type || !date) return;
        try {
            const { data } = await api.get(
                `/milk-entries/premium-rate?seller_id=${seller_id}&milk_type=${milk_type}&date=${date}`
            );
            if (data?.rate_per_liter) {
                set("rate_applied", data.rate_per_liter);
                showFlash("success", t('milkEntry.premiumAutoFilled', { rate: data.rate_per_liter }));
            }
        } catch { }
    };

    const fetchLiveStock = async (date) => {
        try {
            const { data } = await api.get(`/stock/available?date=${date}`);
            setLiveStock({
                cow: parseFloat(data.collected?.cow || 0),
                buffalo: parseFloat(data.collected?.buffalo || 0),
            });
        } catch { }
    };

    useEffect(() => { fetchSellers(); }, []);

    useEffect(() => {
        fetchEntries(fromDate, toDate);
        fetchLiveStock(selectedDate);
        setCurrentPage(1);
        setSearchName("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate, fromDate, toDate]);

    useEffect(() => {
        weightPortConfigRef.current = weightPortConfig;
    }, [weightPortConfig]);

    const handleSellerChange = (id) => {
        const found = sellers.find((s) => String(s.seller_id) === String(id));
        const rawType = (found?.milk_type || "").trim().toLowerCase();
        const newMilkType = (rawType === "cow" || rawType === "buffalo")
            ? rawType
            : form.milk_type;
        setForm(p => ({
            ...p,
            seller_id: id,
            milk_type: newMilkType,
        }));
        setSellerCodeInput(found?.seller_code || "");
        setSellerSearch(found?.name || "");  // ← ADD THIS LINE
        fetchPremiumRate(id, newMilkType, selectedDate);
    };

    const handleSellerCodeChange = (code) => {
        setSellerCodeInput(code);
        if (!code.trim()) {
            set("seller_id", "");
            setSellerSearch("");
            return;
        }
        const found = sellers.find(s =>
            s.seller_code && s.seller_code.toLowerCase() === code.trim().toLowerCase()
        );
        if (found) {
            handleSellerChange(found.seller_id);
            setSellerSearch(found?.name || "");  // ← CHANGE THIS LINE - only set the name
        }
    };

    const handleSave = async () => {
        if (!form.seller_id) { showFlash("error", t('milkEntry.selectSeller')); return; }
        if (!form.quantity) { showFlash("error", t('milkEntry.qtyRequired')); return; }
        if (!form.fat) { showFlash("error", t('milkEntry.fatRequired')); return; }
        if (!form.snf) { showFlash("error", t('milkEntry.snfRequired')); return; }
        if (!form.rate_applied) { showFlash("error", t('milkEntry.rateRequired')); return; }
        if (!isValidFat(form.fat, form.milk_type)) {
            const { min, max } = FAT_LIMITS[form.milk_type] || FAT_LIMITS.cow;
            showFlash("error", t('milkEntry.fatRange', { min, max })); return;
        }
        if (!isValidSnf(form.snf, form.milk_type)) {
            const { min } = SNF_LIMITS[form.milk_type] || SNF_LIMITS.cow;
            showFlash("error", t('milkEntry.snfRange', { min, max: '—' })); return;
        }
        if (saving) return;

        setSaving(true);
        try {
            await api.post("/milk-entries", {
                seller_id: Number(form.seller_id),
                seller_type: sellerType,
                entry_date: selectedDate,
                shift: form.shift,
                milk_type: form.milk_type,
                quantity: Number(form.quantity),
                fat: Number(form.fat),
                snf: Number(form.snf),
                protein: form.protein !== "" ? Number(form.protein) : null,
                water: Number(form.water || 0),
                rate_applied: Number(form.rate_applied),
                total_amount: Number(amount),
            });
            await fetchEntries(selectedDate, selectedDate);
            await fetchLiveStock(selectedDate);
            showFlash("success", t('milkEntry.savedSuccess'));
            setForm({ ...getEmptyForm(sellerType), shift: getShiftByTime() });
            setSellerSearch("");
            setSellerCodeInput("");
            setFatSavedToForm(false);
            setWeightBySubtype(prev => ({
                ...prev,
                weight_gavali: { ...prev.weight_gavali, qty: "", qty2: "" },
                weight_utpadak: { ...prev.weight_utpadak, qty: "", qty2: "" },
                weight: { ...prev.weight, qty: "", qty2: "" },
            }));
            setMachineFat("");
            setMachineSnf("");
            setMachineProtein("");
            lastSavedFatRaw.current = null;
            lastAddedMilkRaw.current = { weight_gavali: null, weight_utpadak: null, weight: null };
            sellerCodeRef.current?.focus();
        } catch (err) {
            const msg = err.response?.data?.error ||
                err.response?.data?.message ||
                t('milkEntry.saveError');
            showFlash("error", msg);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = (entry) => {
        setEditingEntry(entry);
        setSellerSearch(entry.seller_name || "");  // ← CHANGE THIS LINE
        setSellerCodeInput(entry.seller_code || "");
        setFatSavedToForm(true);
        setForm({
            seller_id: String(entry.seller_id),
            seller_type: sellerType,
            shift: entry.shift,
            milk_type: entry.milk_type,
            quantity: String(entry.quantity),
            fat: String(entry.fat),
            snf: String(entry.snf),
            protein: String(entry.protein ?? ""),
            water: String(entry.water || ""),
            rate_applied: String(entry.rate_applied),
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleUpdate = async () => {
        if (!form.quantity || !form.fat || !form.snf || !form.rate_applied) {
            showFlash("error", t('milkEntry.allFieldsRequired')); return;
        }
        if (saving) return;
        if (!isValidFat(form.fat, form.milk_type)) {
            const { min, max } = FAT_LIMITS[form.milk_type] || FAT_LIMITS.cow;
            showFlash("error", t('milkEntry.fatRange', { min, max })); return;
        }
        if (!isValidSnf(form.snf, form.milk_type)) {
            const { min } = SNF_LIMITS[form.milk_type] || SNF_LIMITS.cow;
            showFlash("error", t('milkEntry.snfRange', { min, max: '—' })); return;
        }
        setSaving(true);
        try {
            const computedAmount = (parseFloat(form.quantity) * parseFloat(form.rate_applied)).toFixed(2);
            await api.put(`/milk-entries/${editingEntry.entry_id}`, {
                shift: form.shift,
                milk_type: form.milk_type,
                seller_type: sellerType,
                quantity: Number(form.quantity),
                fat: Number(form.fat),
                snf: Number(form.snf),
                protein: form.protein !== "" ? Number(form.protein) : null,
                water: Number(form.water || 0),
                rate_applied: Number(form.rate_applied),
                total_amount: Number(computedAmount),
            });
            showFlash("success", t('milkEntry.updatedSuccess'));
            await fetchEntries(selectedDate, selectedDate);
            setEditingEntry(null);
            setForm({ ...getEmptyForm(sellerType), shift: getShiftByTime() });
            setSellerSearch("");
            setSellerCodeInput("");
            setFatSavedToForm(false);
            setWeightBySubtype(prev => ({
                ...prev,
                weight_gavali: { ...prev.weight_gavali, qty: "", qty2: "" },
                weight_utpadak: { ...prev.weight_utpadak, qty: "", qty2: "" },
                weight: { ...prev.weight, qty: "", qty2: "" },
            }));
            setMachineFat("");
            setMachineSnf("");
            setMachineProtein("");
            lastSavedFatRaw.current = null;
            lastAddedMilkRaw.current = { weight_gavali: null, weight_utpadak: null, weight: null };
            sellerCodeRef.current?.focus();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('milkEntry.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const isFormReady = () =>
        form.seller_id && form.quantity && form.fat && form.snf && form.rate_applied &&
        isValidFat(form.fat, form.milk_type) && isValidSnf(form.snf, form.milk_type);

    const handleFormKeyDown = (e) => {
        if (e.key !== "Enter") return;
        if (dropdownOpen) return;
        if (e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (saving) return;
        if (!isFormReady()) {
            focusNextField(e.target);
            return;
        }
        editingEntry ? handleUpdate() : handleSave();
    };

    const handleCancelEdit = () => {
        setEditingEntry(null);
        setForm({ ...getEmptyForm(sellerType), shift: getShiftByTime() });
        setSellerSearch("");
        setSellerCodeInput("");
        setFatSavedToForm(false);
        setWeightBySubtype(prev => ({
            ...prev,
            weight_gavali: { ...prev.weight_gavali, qty: "", qty2: "" },
            weight_utpadak: { ...prev.weight_utpadak, qty: "", qty2: "" },
            weight: { ...prev.weight, qty: "", qty2: "" },
        }));
        setMachineFat("");
        setMachineSnf("");
        setMachineProtein("");
        lastSavedFatRaw.current = null;
        lastAddedMilkRaw.current = { weight_gavali: null, weight_utpadak: null, weight: null };
    };

    const handleDelete = async (entryId) => {
        setEntryToDelete(entryId);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (!entryToDelete) return;
        try {
            await api.delete(`/milk-entries/${entryToDelete}`);
            showFlash("success", t('milkEntry.deletedSuccess'));
            await fetchEntries(selectedDate, selectedDate);
            await fetchLiveStock(selectedDate);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('milkEntry.deleteError'));
        } finally {
            setDeleteConfirmOpen(false);
            setEntryToDelete(null);
        }
    };

    const cancelDelete = () => {
        setDeleteConfirmOpen(false);
        setEntryToDelete(null);
    };

    const fetchRangeEntries = async (from = fromDate, to = toDate) => {
        setLoadingRange(true);
        try {
            const base = from === to ? `/milk-entries?date=${from}` : `/milk-entries?from=${from}&to=${to}`;
            const url = `${base}&seller_type=${sellerType}`;
            const { data } = await api.get(url);
            setRangeEntries(data);
            setPdfReady(true);
        } catch {
            showFlash("error", t('milkEntry.rangeLoadError'));
        } finally {
            setLoadingRange(false);
        }
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

    const handleDownloadPDF = () => {
        const data = rangeMode === "daily" ? entries : (pdfReady ? rangeEntries : entries);
        const win = window.open("", "_blank", "width=1200,height=900");
        if (!win) return;

        const modeLabel = rangeMode === "daily" ? t('milkEntry.pdfDaily')
            : rangeMode === "weekly" ? t('milkEntry.pdfWeekly')
                : rangeMode === "monthly" ? t('milkEntry.pdfMonthly')
                    : t('milkEntry.pdfCustom');

        const fmtD = (d) => d
            ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
            : "—";
        const periodLabel = fromDate === toDate
            ? fmtD(fromDate)
            : `${fmtD(fromDate)} ${t('milkEntry.pdfTo')} ${fmtD(toDate)}`;

        const totalCow = data.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const totalBuf = data.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
        const totalAmt = data.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);

        const grouped = {};
        data.forEach(e => {
            const d = (e.entry_date || "").split("T")[0];
            if (!grouped[d]) grouped[d] = [];
            grouped[d].push(e);
        });

        const isMultiDay = Object.keys(grouped).length > 1;
        const cell = "border:1px solid #bbb;padding:4px 5px;";

        let globalCounter = 0;

        const tableRows = Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, dayEntries]) => {
                const dayCow = dayEntries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                const dayBuf = dayEntries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
                const dayAmt = dayEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);

                const dayRows = dayEntries.map((r, i) => {
                    globalCounter++;
                    const isFirst = i === 0;
                    const dateCell = isMultiDay && isFirst
                        ? `<td rowspan="${dayEntries.length}" style="${cell}font-size:8px;font-weight:700;text-align:center;vertical-align:middle;background:#e8e8e8;white-space:nowrap;min-width:30px">
    ${new Date(date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
    </td>`
                        : "";

                    return `
<tr style="background:${i % 2 === 0 ? "#fff" : "#f4f4f4"}">
    ${isMultiDay ? (isFirst ? dateCell : "") : ""}
    <td style="${cell}font-size:8px;text-align:center;color:#555;font-family:monospace">${globalCounter}</td>
    <td style="${cell}font-size:8.5px;font-weight:600">${r.seller_name || `ID:${r.seller_id}`}</td>
    <td style="${cell}font-size:8px;font-family:monospace;text-align:center">${r.seller_code || "—"}</td>
    <td style="${cell}font-size:8px;text-align:center;font-weight:600">${r.shift === "morning" ? t('milkEntry.pdfShiftM') : t('milkEntry.pdfShiftE')}</td>
    <td style="${cell}font-size:8px;text-align:center;font-weight:600">${r.milk_type === "cow" ? t('milkEntry.pdfCowShort') : t('milkEntry.pdfBufShort')}</td>
    <td style="${cell}font-size:8.5px;text-align:right;font-weight:700">${parseFloat(r.quantity || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.fat || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.snf || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.protein || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right${parseFloat(r.water) > 5 ? ";font-weight:700;text-decoration:underline" : ""}">
        ${parseFloat(r.water || 0).toFixed(2)}${parseFloat(r.water) > 5 ? "!" : ""}
    </td>
    <td style="${cell}font-size:8.5px;text-align:right">${parseFloat(r.rate_applied || 0).toFixed(2)}</td>
    <td style="${cell}font-size:8.5px;text-align:right;font-weight:700;background:#e8e8e8">${parseFloat(r.total_amount || 0).toFixed(2)}</td>
</tr>`;
                }).join("");

                const subtotal = isMultiDay ? `
<tr style="background:#ddd;border-top:2px solid #000">
    <td colspan="5" style="${cell}font-size:8px;font-weight:700">
        ${fmtD(date)} — ${dayEntries.length} ${t('milkEntry.pdfEntries')} &nbsp;|&nbsp; ${t('milkEntry.pdfCow')} ${dayCow.toFixed(2)} L &nbsp;|&nbsp; ${t('milkEntry.pdfBuf')} ${dayBuf.toFixed(2)} L
    </td>
    <td style="${cell}font-size:8px;text-align:right;font-weight:700">${(dayCow + dayBuf).toFixed(2)}</td>
    <td colspan="5" style="${cell}font-size:8px"></td>
    <td style="${cell}font-size:8px;text-align:right;font-weight:700;background:#ccc">${dayAmt.toFixed(2)}</td>
</tr>` : "";

                return dayRows + subtotal;
            }).join("");

        win.document.write(`<!DOCTYPE html><html><head>
<title>${t('milkEntry.pdfMilkCollection')} (${sellerType}) — ${modeLabel} — ${periodLabel}</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; background: #fff; margin: 0; padding: 12px; }
    table { border-collapse: collapse; width: 100%; border: 2px solid #000; }
    @media print {
        @page { margin: 6mm; size: A4 portrait; }
        body { padding: 0; }
    }
    @media screen { body { max-width: 177mm; margin: 0 auto; } }
</style>
</head><body>

<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px">
    <div>
        <div style="font-size:16px;font-weight:900;color:#000;letter-spacing:0.5px">${appName}</div>
        <div style="font-size:10px;font-weight:600;color:#000;margin-top:2px">${t('milkEntry.pdfMilkCollection')} · ${sellerType} — ${modeLabel} · ${periodLabel}</div>
        <div style="font-size:8.5px;color:#555;margin-top:1px">${t('milkEntry.pdfGenerated')} ${new Date().toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</div>
    </div>
    <div style="display:flex;gap:6px;align-items:stretch">
        ${[
                { label: t('milkEntry.pdfCowMilk'), val: totalCow.toFixed(2) + " L" },
                { label: t('milkEntry.pdfBuffaloMilk'), val: totalBuf.toFixed(2) + " L" },
                { label: t('milkEntry.pdfTotalEntries'), val: data.length },
                { label: t('milkEntry.pdfTotalAmount'), val: "Rs. " + totalAmt.toFixed(2) },
            ].map(({ label, val }) =>
                `<div style="border:1.5px solid #000;padding:5px 10px;text-align:center;min-width:70px">
                <div style="font-size:7.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#333">${label}</div>
                <div style="font-size:13px;font-weight:900;color:#000;margin-top:1px">${val}</div>
            </div>`
            ).join("")}
    </div>
</div>

<table>
    <thead>
        <tr style="background:#000;color:#fff">
            ${isMultiDay ? `<th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:4%">${t('milkEntry.pdfDate')}</th>` : ""}
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:3%">${t('milkEntry.colNo')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:left;width:${isMultiDay ? "13" : "16"}%">${t('milkEntry.pdfSeller')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:6%">${t('milkEntry.pdfCode')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:5%">${t('milkEntry.pdfShift')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:center;width:5%">${t('milkEntry.pdfMilk')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:7%">${t('milkEntry.pdfQty')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfFat')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfSnf')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfProtein')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:6%">${t('milkEntry.pdfWater')}</th>
            <th style="padding:4px 5px;border:1px solid #555;font-size:8px;text-align:right;width:7%">${t('milkEntry.pdfRate')}</th>
            <th style="padding:4px 5px;border:1px solid #555;background:#222;font-size:8px;text-align:right;width:9%">${t('milkEntry.pdfAmountRs')}</th>
        </tr>
    </thead>
    <tbody>
        ${tableRows}
        <tr style="background:#000;color:#fff;border-top:2px solid #000">
            <td colspan="${isMultiDay ? 6 : 5}" style="padding:5px 6px;border:1px solid #555;font-size:9px;font-weight:700">
                ${t('milkEntry.pdfGrandTotal')} — ${data.length} ${t('milkEntry.pdfEntries')} &nbsp;|&nbsp; ${t('milkEntry.pdfCow')} ${totalCow.toFixed(2)} L &nbsp;|&nbsp; ${t('milkEntry.pdfBuf')} ${totalBuf.toFixed(2)} L
            </td>
            <td style="padding:5px 6px;border:1px solid #555;font-size:9px;text-align:right;font-weight:700">
                ${(totalCow + totalBuf).toFixed(2)}
            </td>
            <td colspan="5" style="padding:5px 6px;border:1px solid #555;font-size:9px"></td>
            <td style="padding:5px 6px;border:1px solid #555;background:#333;font-size:9px;text-align:right;font-weight:900">
                Rs. ${totalAmt.toFixed(2)}
            </td>
        </tr>
    </tbody>
</table>

<div style="margin-top:16px;display:flex;justify-content:space-between;font-size:8px;color:#555;border-top:1px solid #ccc;padding-top:6px">
    <span>${t('milkEntry.pdfFooter')}</span>
    <span>${t('milkEntry.pdfSignatory')}</span>
</div>

<script>window.onload = () => { window.print(); };<\/script>
</body></html>`);
        win.document.close();
    };

    const filteredSellers = (() => {
        const sorted = [...sellers].sort((a, b) => a.name.localeCompare(b.name));
        if (!sellerSearch.trim()) return sorted.slice(0, 5);
        const matched = sorted.filter((s) =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase())
        );
        return matched.slice(0, 5);
    })();

    const selectedSeller = sellers.find((s) => String(s.seller_id) === String(form.seller_id));

    const filteredEntries = searchName.trim()
        ? entries.filter(e => (e.seller_name || "").toLowerCase().includes(searchName.toLowerCase()))
        : entries;
    const totalPages = Math.ceil(filteredEntries.length / pageSize);
    const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const COLS = [
        t('milkEntry.colCode'), t('milkEntry.colQty'), t('milkEntry.colFat'), t('milkEntry.colSnf'),
        ...(isAdmin ? [t('milkEntry.colRate'), t('milkEntry.colAmount'), ''] : [])
    ];
    const GRID = isAdmin
        ? "90px 70px 65px 65px 90px 130px 90px"
        : "90px 70px 65px 65px";

    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('milk_entry', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            {flash && (
                <div
                    className={`fixed top-4 right-4 z-[9999] pointer-events-none`}
                    style={{ maxWidth: "min(92vw, 420px)" }}
                >
                    <div
                        className={`pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl text-base font-semibold shadow-2xl backdrop-blur-sm border
                        ${flash.type === "success" ? "bg-emerald-50/95 border-emerald-200/70 text-emerald-700" : "bg-rose-50/95 border-rose-200/70 text-rose-600"}`}
                        style={{
                            transform: flashPhase === "visible" ? "translateX(0)" : "translateX(150%)",
                            opacity: flashPhase === "visible" ? 1 : 0,
                            transition: "transform 420ms cubic-bezier(0.22, 1, 0.36, 1), opacity 420ms ease",
                        }}
                    >
                        {flash.type === "error" && <AlertTriangle size={18} className="shrink-0" />}
                        {flash.type === "success" && <BadgeCheck size={18} className="shrink-0" />}
                        <span className="flex-1">{flash.msg}</span>
                        <button onClick={dismissFlash} className="opacity-50 hover:opacity-100 transition shrink-0">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <main className="h-screen max-w-screen mx-auto px-4 py-3 flex flex-col gap-2">

                {/* ── Stat Cards ── */}
                <div className={`grid grid-cols-2 sm:grid-cols-3 ${isAdmin ? "lg:grid-cols-6" : "lg:grid-cols-2"} gap-2 shrink-0`}>
                    <StatCard
                        label={t('milkEntry.entriesToday', { defaultValue: 'Entries Today' })}
                        value={entries.length}
                        icon={<Droplets size={16} className="text-blue-700" />}
                        color="from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700"
                    />
                    <StatCard
                        label={t('milkEntry.cowMilk', { defaultValue: 'Cow Milk (L)' })}
                        value={`${entries.filter(e => e.milk_type === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)} L`}
                        icon={<Milk size={16} className="text-amber-700" />}
                        color="from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700"
                    />
                    <StatCard
                        label={t('milkEntry.buffaloMilk', { defaultValue: 'Buffalo Milk (L)' })}
                        value={`${entries.filter(e => e.milk_type === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(1)} L`}
                        icon={<Milk size={16} className="text-slate-700" />}
                        color="from-slate-50 to-slate-100/50 border-slate-200/60 text-slate-700"
                    />
                    <StatCard
                        label={t('milkEntry.totalAmount', { defaultValue: 'Total Amount' })}
                        value={`₹${entries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0).toFixed(2)}`}
                        icon={<TrendingUp size={16} className="text-violet-700" />}
                        color="from-violet-50 to-violet-100/50 border-violet-200/60 text-violet-700"
                    />
                    <StatCard
                        label={t('milkEntry.remainingMorning', { defaultValue: 'Remaining (Morning)' })}
                        value={`${remainingMorningSellers} ${t('milkEntry.sellers', { defaultValue: 'farmers' })}`}
                        icon={<Sun size={16} className="text-amber-700" />}
                        color="from-amber-50 to-amber-100/50 border-amber-200/60 text-amber-700"
                    />
                    <StatCard
                        label={t('milkEntry.remainingEvening', { defaultValue: 'Remaining (Evening)' })}
                        value={`${remainingEveningSellers} ${t('milkEntry.sellers', { defaultValue: 'farmers' })}`}
                        icon={<Moon size={16} className="text-indigo-700" />}
                        color="from-indigo-50 to-indigo-100/50 border-indigo-200/60 text-indigo-700"
                    />
                </div>

                <div className="flex-1 flex gap-4 min-h-0">

                    {/* ── LEFT PANEL: Machine Integration & Inputs ── */}
                    <div className="w-[75%] flex flex-col gap-2 h-full min-h-0">

                        {/* ── Machine sections — role-specific, single scale ── */}
                        <div className="flex gap-3 shrink-0">
                            {/* Weight instrument with Live Capture toggle */}
                            <div className="flex-1 rounded-xl bg-white/90 backdrop-blur-sm border border-emerald-200/60 shadow-lg shadow-emerald-200/30 overflow-hidden">
                                <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50/70 border border-emerald-200/60 flex items-center justify-center shrink-0">
                                            <Scale size={14} className="text-emerald-600" />
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-extrabold text-emerald-700 uppercase tracking-widest leading-none">
                                                Scale
                                            </span>
                                            <span className="block text-[9px] text-gray-400 font-semibold">
                                                {sellerType}
                                            </span>
                                        </div>
                                    </div>
                                    <ConnectionPill connected={isMachineConnected} />
                                </div>

                                <div className="flex items-center justify-center gap-2 px-3 py-0.5 min-h-[52px]">
                                    {sellerType === "Gavali" ? (
                                        <>
                                            <DigitReadout label="Qty · Kg" value={machineQty} unit={machineUom} connected={isMachineConnected} accent="emerald" primary width="90px" />
                                            <span className="text-emerald-200 text-lg font-black">/</span>
                                            <DigitReadout label="Qty · L" value={machineQty2} unit={machineUom2} connected={isMachineConnected} accent="emerald" width="80px" />
                                        </>
                                    ) : (
                                        <DigitReadout label="Qty · L" value={machineQty2} unit={machineUom2} connected={isMachineConnected} accent="emerald" primary width="100px" />
                                    )}
                                </div>

                                <div className="flex items-center justify-between gap-1 px-3 py-1 border-t border-gray-100/60 bg-gray-50/60">
                                    <span className="text-[9px] text-gray-500 font-mono truncate">
                                        {weightPortConfig[activeWeightKey]?.serial_port || "No port"}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => connectSerialPort(activeWeightSubtypeParam)}
                                            disabled={isMachineConnected}
                                            className={`flex items-center gap-0.5 text-[9px] font-bold px-2.5 py-1 rounded-lg transition ${isMachineConnected
                                                ? "bg-emerald-400 text-emerald-950"
                                                : "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                                                }`}
                                        >
                                            <Plug size={9} /> {isMachineConnected ? "On" : "Connect"}
                                        </button>
                                        {isMachineConnected && (
                                            <button
                                                type="button"
                                                onClick={() => disconnectMachine(activeWeightSubtypeParam)}
                                                className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 transition"
                                            >
                                                Off
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 px-3 py-1 border-t border-gray-100/60 bg-white/70">
                                    <button
                                        type="button"
                                        onClick={addMilkFromScale}
                                        disabled={liveMilkCaptureEnabled}
                                        className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 hover:shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Milk size={11} /> Save ({machineQty2 || "—"}L)
                                    </button>
                                    <div className="flex items-center gap-1 ml-auto">
                                        <span className="text-[7px] font-bold text-blue-600/70 uppercase tracking-wider">Live</span>
                                        <button
                                            type="button"
                                            onClick={() => setLiveMilkCaptureEnabled(v => !v)}
                                            className={`relative w-7 h-3.5 rounded-full transition-colors shadow-sm ${liveMilkCaptureEnabled ? "bg-blue-500" : "bg-gray-300"}`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transform transition-transform ${liveMilkCaptureEnabled ? "translate-x-3.5" : ""}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Fat & SNF instrument with Save Reading and Live Capture */}
                            <div className="flex-1 rounded-xl bg-white/90 backdrop-blur-sm border border-amber-200/60 shadow-lg shadow-amber-200/30 overflow-hidden">
                                <div className="flex items-center justify-between px-3 pt-1.5 pb-0.5">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-amber-50/70 border border-amber-200/60 flex items-center justify-center shrink-0">
                                            <FlaskConical size={14} className="text-amber-600" />
                                        </div>
                                        <div>
                                            <span className="block text-[10px] font-extrabold text-amber-700 uppercase tracking-widest leading-none">
                                                Analyzer
                                            </span>
                                            <span className="block text-[9px] text-gray-400 font-semibold">
                                                Fat & SNF
                                            </span>
                                        </div>
                                    </div>
                                    <ConnectionPill connected={isFatConnected} />
                                </div>

                                <div className="flex items-center justify-center gap-1 px-3 py-0.5 min-h-[52px]">
                                    <DigitReadout
                                        label="Fat %"
                                        value={fatSavedToForm ? form.fat || machineFat : machineFat}
                                        connected={isFatConnected}
                                        accent="amber"
                                        primary
                                        width="75px"
                                    />
                                    <DigitReadout
                                        label="SNF %"
                                        value={fatSavedToForm ? form.snf || machineSnf : machineSnf}
                                        connected={isFatConnected}
                                        accent="amber"
                                        primary
                                        width="75px"
                                    />
                                    <DigitReadout
                                        label="Protein %"
                                        value={fatSavedToForm ? form.protein || machineProtein : machineProtein}
                                        connected={isFatConnected}
                                        accent="rose"
                                        width="70px"
                                    />
                                </div>

                                <div className="flex items-center justify-between gap-1 px-3 py-1 border-t border-gray-100/60 bg-gray-50/60">
                                    <span className="text-[9px] text-gray-500 font-mono truncate">
                                        {fatPortConfig?.serial_port || "No port"}
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={connectFatPort}
                                            disabled={isFatConnected}
                                            className={`flex items-center gap-0.5 text-[9px] font-bold px-2.5 py-1 rounded-lg transition ${isFatConnected
                                                ? "bg-amber-400 text-amber-950"
                                                : "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30"
                                                }`}
                                        >
                                            <Plug size={9} /> {isFatConnected ? "On" : "Connect"}
                                        </button>
                                        {isFatConnected && (
                                            <button
                                                type="button"
                                                onClick={disconnectFatMachine}
                                                className="text-[9px] font-bold px-2.5 py-1 rounded-lg bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 transition"
                                            >
                                                Off
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 px-3 py-1 border-t border-gray-100/60 bg-white/70">
                                    <button
                                        type="button"
                                        onClick={saveFatReadingToForm}
                                        className="flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30 hover:shadow-lg transition"
                                    >
                                        <Save size={11} /> Save Reading
                                    </button>
                                    <div className="flex items-center gap-1 ml-auto">
                                        <span className="text-[7px] font-bold text-amber-600/70 uppercase tracking-wider">Live</span>
                                        <button
                                            type="button"
                                            onClick={() => setLiveFatCaptureEnabled(v => !v)}
                                            className={`relative w-7 h-3.5 rounded-full transition-colors shadow-sm ${liveFatCaptureEnabled ? "bg-amber-500" : "bg-gray-300"}`}
                                        >
                                            <span className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transform transition-transform ${liveFatCaptureEnabled ? "translate-x-3.5" : ""}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Form fields ── */}
                        <div className="flex-1 flex flex-col gap-0.5 overflow-y-auto min-h-0">
                            <div data-entry-form className="flex flex-col gap-1.5 p-2 rounded-xl bg-gray-50/70 backdrop-blur-sm border border-gray-100/60 shadow-sm shrink-0" onKeyDown={handleFormKeyDown}>

                                {/* Row 1: Code + Seller */}
                                <div className="flex items-start gap-1.5 flex-wrap">
                                    <Field label="Code" icon={<User size={10} />}>
                                        <TinyInput
                                            ref={sellerCodeRef}
                                            value={sellerCodeInput}
                                            onChange={(e) => handleSellerCodeChange(e.target.value)}
                                            placeholder="SC-001"
                                            className="text-[13px] font-mono"
                                            style={{ width: "65px" }}
                                        />
                                    </Field>

                                    <Field label={t('milkEntry.sellerLabel')} icon={<User size={10} />}>
                                        <div className="relative" style={{ width: "220px" }}>
                                            <TinyInput
                                                ref={sellerInputRef}
                                                value={sellerSearch}
                                                onFocus={() => { setDropdownOpen(true); setHighlightedIdx(-1); }}
                                                onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSellerSearch(val);
                                                    setHighlightedIdx(-1);
                                                    setDropdownOpen(true);
                                                    if (!val) { set("seller_id", ""); setSellerCodeInput(""); return; }
                                                }}
                                                onKeyDown={(e) => {
                                                    if (!dropdownOpen || filteredSellers.length === 0) return;
                                                    if (e.key === "ArrowDown") {
                                                        e.preventDefault();
                                                        setHighlightedIdx(i => Math.min(i + 1, filteredSellers.length - 1));
                                                    } else if (e.key === "ArrowUp") {
                                                        e.preventDefault();
                                                        setHighlightedIdx(i => Math.max(i - 1, 0));
                                                    } else if (e.key === "Enter") {
                                                        e.preventDefault();
                                                        if (highlightedIdx >= 0 && filteredSellers[highlightedIdx]) {
                                                            const sel = filteredSellers[highlightedIdx];
                                                            handleSellerChange(sel.seller_id);
                                                            setSellerSearch(sellerLabel(sel));
                                                            setDropdownOpen(false);
                                                            focusNextField(e.currentTarget);
                                                        } else {
                                                            setDropdownOpen(false);
                                                            focusNextField(e.currentTarget);
                                                        }
                                                    } else if (e.key === "Escape") {
                                                        setDropdownOpen(false);
                                                    }
                                                }}
                                                placeholder={`${t('milkEntry.searchPlaceholder')} (${sellerType})`}
                                                className="pr-6 text-[15px]"
                                                style={{ width: "220px" }}
                                            />
                                            <DropdownPortal
                                                anchorRef={sellerInputRef}
                                                open={dropdownOpen && !form.seller_id && filteredSellers.length > 0}
                                                width={200}
                                            >
                                                <p className="px-3 py-1 text-[9px] font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100/60">
                                                    {sellerSearch.trim() ? `${filteredSellers.length} ${filteredSellers.length !== 1 ? t('milkEntry.matchesPlural') : t('milkEntry.matches')}` : t('milkEntry.sellersAZ')}
                                                </p>
                                                {filteredSellers.map((s, idx) => (
                                                    <button key={s.seller_id} type="button"
                                                        onMouseEnter={() => setHighlightedIdx(idx)}
                                                        onMouseDown={(e) => e.preventDefault()}
                                                        onClick={() => {
                                                            handleSellerChange(s.seller_id);
                                                            setSellerSearch(s.name || "");
                                                            setDropdownOpen(false);
                                                        }}
                                                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition
                                            ${highlightedIdx === idx ? "bg-gray-100" : "hover:bg-gray-50"}`}>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-gray-800 text-xs flex items-center gap-1 truncate">
                                                                {sellerLabel(s)}
                                                            </p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </DropdownPortal>
                                            {selectedSeller && (
                                                <button type="button" onClick={() => { set("seller_id", ""); setSellerSearch(""); setSellerCodeInput(""); setDropdownOpen(false); }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                                    <X size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </Field>
                                </div>

                                {/* Row 2: Shift, Qty, Fat, SNF, Rate */}
                                <div className="flex items-start gap-1.5 flex-wrap">
                                    <Field label={t('milkEntry.shiftLabel')} icon={form.shift === "morning" ? <Sun size={10} /> : <Moon size={10} />}>
                                        <ShiftToggle value={form.shift} onChange={(v) => set("shift", v)} t={t} />
                                    </Field>

                                    <Field label={t('milkEntry.qtyLabel')} icon={<Droplets size={10} />}>
                                        <TinyInput value={form.quantity} onChange={(e) => set("quantity", e.target.value)}
                                            placeholder="0.0" type="number" step="0.01"
                                            className="bg-blue-50/30 border-blue-200/60 text-blue-700 font-extrabold focus:ring-blue-500/50 text-[17px]"
                                            style={{ width: "110px" }} />
                                    </Field>

                                    <Field label={t('milkEntry.fatLabel')} icon={<FlaskConical size={10} />}>
                                        <TinyInput
                                            value={form.fat}
                                            onChange={(e) => {
                                                set("fat", e.target.value);
                                                setFatSavedToForm(false);
                                                fetchAutoRate(e.target.value, form.snf, form.milk_type);
                                            }}
                                            placeholder="0.0" type="number" step="0.01"
                                            className="bg-amber-50/30 border-amber-200/60 text-amber-700 font-extrabold focus:ring-amber-500/50 text-[17px]"
                                            style={{ width: "95px" }} />
                                    </Field>

                                    <Field label={t('milkEntry.snfLabel')} icon={<FlaskConical size={10} />}>
                                        <div className="relative">
                                            <TinyInput
                                                value={form.snf}
                                                onChange={(e) => {
                                                    set("snf", e.target.value);
                                                    setFatSavedToForm(false);
                                                    fetchAutoRate(form.fat, e.target.value, form.milk_type);
                                                }}
                                                placeholder="0.0" type="number" step="0.01"
                                                className={
                                                    "font-extrabold text-[17px] " + (snfBelowThreshold(form.snf, form.milk_type)
                                                        ? "bg-rose-50/30 border-rose-300/60 text-rose-600 focus:ring-rose-500/50"
                                                        : snfAboveThreshold(form.snf, form.milk_type)
                                                            ? "bg-emerald-50/30 border-emerald-200/60 text-emerald-700 focus:ring-emerald-500/50"
                                                            : "bg-violet-50/30 border-violet-200/60 text-violet-700 focus:ring-violet-500/50")
                                                }
                                                style={{ width: "95px" }} />
                                            {snfBelowThreshold(form.snf, form.milk_type) && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 flex items-center justify-center shadow-sm">
                                                    <AlertTriangle size={6} className="text-white" />
                                                </span>
                                            )}
                                            {snfAboveThreshold(form.snf, form.milk_type) && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm">
                                                    <BadgeCheck size={6} className="text-white" />
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-[8px] font-bold mt-0.5 h-[11px] leading-[11px] ${snfBelowThreshold(form.snf, form.milk_type)
                                            ? "text-rose-500"
                                            : snfAboveThreshold(form.snf, form.milk_type)
                                                ? "text-emerald-600"
                                                : "invisible"
                                            }`}>
                                            {snfBelowThreshold(form.snf, form.milk_type)
                                                ? `Below ${SNF_THRESHOLD[form.milk_type]}%`
                                                : snfAboveThreshold(form.snf, form.milk_type)
                                                    ? "✓"
                                                    : "—"}
                                        </p>
                                    </Field>

                                    {isAdmin && (
                                        <Field label={t('milkEntry.rateLabel')} icon={<TrendingUp size={10} />}>
                                            <TinyInput value={form.rate_applied} onChange={(e) => set("rate_applied", e.target.value)}
                                                placeholder="₹0.00" type="number" step="0.01"
                                                className="bg-gray-100/60 border-gray-300/60 text-gray-900 font-extrabold text-[17px]"
                                                style={{ width: "120px" }} />
                                        </Field>
                                    )}
                                </div>

                                {/* Row 3: Protein, Water, Amount */}
                                <div className="flex items-start gap-1.5 flex-wrap">
                                    <Field label="Protein" icon={<FlaskConical size={10} />}>
                                        <TinyInput
                                            value={form.protein}
                                            onChange={(e) => {
                                                set("protein", e.target.value);
                                                setFatSavedToForm(false);
                                            }}
                                            placeholder="0.0" type="number" step="0.01"
                                            className="bg-pink-50/30 border-pink-200/60 text-pink-700 font-bold focus:ring-pink-500/50 text-[13px]"
                                            style={{ width: "65px" }} />
                                    </Field>

                                    <Field label={t('milkEntry.waterLabel')} icon={<Waves size={10} />}>
                                        <div className="relative">
                                            <TinyInput value={form.water} onChange={(e) => set("water", e.target.value)}
                                                placeholder="0.0" type="number" step="0.01"
                                                className={"font-bold text-[13px] " + (waterRisk(form.water)
                                                    ? "bg-rose-50/30 border-rose-300/60 text-rose-600 focus:ring-rose-500/50"
                                                    : "bg-emerald-50/30 border-emerald-200/60 text-emerald-700 focus:ring-emerald-500/50")}
                                                style={{ width: "65px" }} />
                                            {waterRisk(form.water) && (
                                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-rose-500 flex items-center justify-center shadow-sm">
                                                    <AlertTriangle size={6} className="text-white" />
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-[8px] font-bold mt-0.5 h-[11px] leading-[11px] ${waterRisk(form.water) ? "text-rose-500" : "invisible"}`}>
                                            {waterRisk(form.water) ? t('milkEntry.waterRisk') : "—"}
                                        </p>
                                    </Field>

                                    {isAdmin && amount && (
                                        <Field label={t('milkEntry.amountLabel')} icon={<TrendingUp size={10} />}>
                                            <div className="h-[38px] px-3 flex items-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 border border-emerald-700 text-white font-extrabold text-base whitespace-nowrap shadow-lg shadow-emerald-500/30">
                                                ₹{amount}
                                            </div>
                                        </Field>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 border-t border-gray-200/60 shrink-0">
                                <p className="text-sm text-gray-400">
                                    {entries.length} {entries.length === 1 ? t('milkEntry.entry') : t('milkEntry.entries')} {t('milkEntry.entriesOn')}{" "}
                                    {new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </p>

                                <div className="flex items-center gap-2 flex-wrap">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider">{t('milkEntry.dateLabel')}</span>
                                        <input type="date" value={selectedDate}
                                            onChange={(e) => { setSelectedDate(e.target.value); setFromDate(e.target.value); setToDate(e.target.value); }}
                                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1.5 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-36" />
                                    </div>

                                    {can('product_sales', 'C') && (
                                        <button
                                            type="button"
                                            onClick={() => setShowProductModal(true)}
                                            disabled={!form.seller_id}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-500 hover:border-blue-300/60 hover:text-blue-600 hover:bg-blue-50/40 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                                        >
                                            <ShoppingCart size={12} /> Product
                                        </button>
                                    )}
                                    {can('cattle_feed_sales', 'C') && (
                                        <button
                                            type="button"
                                            onClick={() => setShowFeedModal(true)}
                                            disabled={!form.seller_id}
                                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border border-gray-200/60 bg-white/50 backdrop-blur-sm text-gray-500 hover:border-emerald-300/60 hover:text-emerald-600 hover:bg-emerald-50/40 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
                                        >
                                            <Package size={12} /> Feed
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={editingEntry ? handleUpdate : handleSave}
                                        disabled={saving}
                                        className={`flex items-center gap-1.5 px-5 py-2 rounded-lg font-bold text-base text-white shadow-lg transition-all duration-200
                                        ${saving ? "bg-gray-300 cursor-not-allowed shadow-gray-300/30" : editingEntry ? "bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 active:scale-95" : "bg-gradient-to-br from-gray-900 to-gray-800 shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 active:scale-95"}`}
                                    >
                                        <Save size={14} />
                                        {saving ? (editingEntry ? t('milkEntry.updating') : t('milkEntry.saving')) : editingEntry ? t('milkEntry.updateEntry') : t('milkEntry.saveEntry')}
                                    </button>
                                </div>
                            </div>

                            {editingEntry && (
                                <div className="px-4 py-1.5 rounded-xl bg-amber-50/80 backdrop-blur-sm border border-amber-200/60 text-amber-700 text-xs font-semibold shadow-sm shrink-0">
                                    ✏ {t('milkEntry.editingBanner')} <strong>{editingEntry.seller_name}</strong> · {editingEntry.shift === "morning" ? t('milkEntry.morning') : t('milkEntry.evening')} · {new Date(editingEntry.entry_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                    <button onClick={handleCancelEdit} className="ml-4 text-xs text-gray-500 hover:text-gray-700 transition">
                                        <X size={12} className="inline mr-1" /> {t('milkEntry.cancelEdit')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── RIGHT PANEL: Logs ── */}
                    <div className="w-1/2 flex flex-col bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden h-full min-h-0">

                        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50 shrink-0">
                            <input
                                type="text"
                                value={searchName}
                                onChange={e => { setSearchName(e.target.value); setCurrentPage(1); }}
                                placeholder={t('milkEntry.filterPlaceholder')}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-1 text-xs text-gray-700 shadow-sm placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-44"
                            />
                            {searchName && (
                                <button onClick={() => { setSearchName(""); setCurrentPage(1); }}
                                    className="text-gray-400 hover:text-gray-600 transition">
                                    <X size={13} />
                                </button>
                            )}
                            <button onClick={handleDownloadPDF} disabled={entries.length === 0}
                                className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gray-900 text-white disabled:opacity-40 transition shadow-sm">
                                PDF
                            </button>
                            <span className="text-sm text-gray-400 font-medium">
                                {filteredEntries.length} {filteredEntries.length === 1 ? t('milkEntry.entry') : t('milkEntry.entries')}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto min-h-0">
                            <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50 sticky top-0 z-10" style={{ gridTemplateColumns: GRID }}>
                                {COLS.map((label, li) => (
                                    <div key={label || `col-${li}`} className="px-3 py-2 flex items-center text-[11px] font-bold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
                                        {label}
                                    </div>
                                ))}
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                                </div>
                            ) : entries.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-300">
                                    <Droplets size={32} className="text-gray-200" />
                                    <p className="text-sm font-medium">{t('milkEntry.noEntries')}</p>
                                </div>
                            ) : (
                                <div>
                                    {paginatedEntries.map((r, i) => (
                                        <div key={r.entry_id || i}
                                            className="grid border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors cursor-pointer"
                                            onClick={() => handleEdit(r)}
                                            style={{ gridTemplateColumns: GRID }}>

                                            <TableCell>
                                                <span className="font-mono text-xs text-gray-700 bg-gray-50/80 border border-gray-200/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-bold">
                                                    {r.seller_code || "—"}
                                                </span>
                                            </TableCell>

                                            <TableCell className="text-blue-700 font-mono font-bold text-xs">{r.quantity}</TableCell>
                                            <TableCell className="text-amber-700 font-mono font-bold text-xs">{r.fat}</TableCell>
                                            <TableCell className="text-violet-700 font-mono font-bold text-xs">{r.snf}</TableCell>

                                            {isAdmin && (
                                                <>
                                                    <TableCell className="text-gray-700 font-mono text-xs font-bold">₹{parseFloat(r.rate_applied || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="text-gray-900 font-extrabold text-xs">₹{parseFloat(r.total_amount || 0).toFixed(2)}</TableCell>
                                                    <TableCell className="!px-1 justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleEdit(r); }}
                                                            title="Edit entry"
                                                            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 border border-blue-200/60 transition"
                                                        >
                                                            <Pencil size={12} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleDelete(r.entry_id); }}
                                                            title="Delete entry"
                                                            className="w-6 h-6 shrink-0 flex items-center justify-center rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-500 border border-rose-200/60 transition"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </TableCell>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {filteredEntries.length > 0 && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2 border-t border-gray-200/60 bg-white/80 shrink-0">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={currentPage === 1}
                                        className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm">
                                        {t('milkEntry.prev')}
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                                            .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                                            .reduce((acc, p, idx, arr) => {
                                                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                                                acc.push(p);
                                                return acc;
                                            }, [])
                                            .map((p, i) =>
                                                p === '...'
                                                    ? <span key={`dot-${i}`} className="px-1 text-xs text-gray-400">…</span>
                                                    : <button key={p} onClick={() => setCurrentPage(p)}
                                                        className={`w-6 h-6 rounded-lg text-xs font-bold transition border shadow-sm
                                                        ${currentPage === p ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-lg shadow-gray-900/30' : 'bg-white/50 text-gray-500 border-gray-200/60 hover:border-gray-300/80 hover:bg-gray-50/50'}`}>
                                                        {p}
                                                    </button>
                                            )}
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        disabled={currentPage === totalPages || totalPages === 0}
                                        className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-200/60 bg-white/50 text-gray-500 hover:bg-gray-50/50 disabled:opacity-40 transition shadow-sm">
                                        {t('milkEntry.next')}
                                    </button>
                                    <span className="text-xs text-gray-400 ml-1">
                                        {filteredEntries.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredEntries.length)}`} {t('milkEntry.of')} {filteredEntries.length}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-400">{t('milkEntry.rowsPerPage')}</span>
                                    <input
                                        type="number" min={1} max={filteredEntries.length || 1}
                                        value={pageSize}
                                        onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                        className="w-12 border border-gray-200/60 rounded-lg px-1 py-0.5 text-xs text-center text-gray-700 bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 transition shadow-sm"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* ── Delete Confirmation Modal ── */}
            {deleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">{t('milkEntry.confirmDeletion')}</h2>
                                    <p className="text-[10px] text-gray-400">{t('milkEntry.cannotUndo')}</p>
                                </div>
                            </div>
                            <button onClick={cancelDelete} className="text-gray-300 hover:text-gray-500 transition">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="px-6 py-4">
                            <p className="text-sm text-gray-600">
                                {t('milkEntry.deleteWarning')}
                            </p>

                            {entryToDelete && (
                                <div className="mt-4 p-3 bg-gray-50 rounded-xl">
                                    <p className="text-xs text-gray-500 mb-1">{t('milkEntry.entryDetails')}</p>
                                    {(() => {
                                        const entry = entries.find(e => e.entry_id === entryToDelete);
                                        if (!entry) return null;

                                        return (
                                            <div className="grid grid-cols-2 gap-3 text-xs">
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailSeller')}</p>
                                                    <p className="font-medium text-gray-800">{entry.seller_name || `ID:${entry.seller_id}`}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailDate')}</p>
                                                    <p className="font-medium text-gray-800">{fmtDate(entry.entry_date)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailShift')}</p>
                                                    <p className="font-medium text-gray-800 capitalize">{entry.shift}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailMilkType')}</p>
                                                    <p className="font-medium text-gray-800 capitalize">{entry.milk_type}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailQty')}</p>
                                                    <p className="font-medium text-gray-800">{entry.quantity} L</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-400">{t('milkEntry.detailAmount')}</p>
                                                    <p className="font-medium text-gray-800">₹{parseFloat(entry.total_amount || 0).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={cancelDelete}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                {t('milkEntry.cancel')}
                            </button>
                            <button onClick={confirmDelete}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 transition">
                                {t('milkEntry.deleteEntry')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Quick Sale Modals ── */}
            {showProductModal && (
                <QuickProductSaleModal
                    sellerId={form.seller_id}
                    sellerName={selectedSeller?.name || ""}
                    saleDate={selectedDate}
                    onClose={() => setShowProductModal(false)}
                    onSuccess={() => { }}
                    showFlash={showFlash}
                />
            )}
            {showFeedModal && (
                <QuickFeedSaleModal
                    sellerId={form.seller_id}
                    sellerName={selectedSeller?.name || ""}
                    saleDate={selectedDate}
                    onClose={() => setShowFeedModal(false)}
                    onSuccess={() => { }}
                    showFlash={showFlash}
                />
            )}
        </div>
    );
}