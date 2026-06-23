import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
    ArrowLeft, User, Phone, CreditCard, MapPin, Landmark,
    Building2, Hash, Calendar, RefreshCw, AlertTriangle,
    FlaskConical, Milk, TrendingUp, Wallet, ShoppingBag,
    Clock, ChevronRight, BadgeCheck, Pencil, Trash2, Save,
    X, Banknote, Star, Vault,
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';



// ── helpers ───────────────────────────────────────────────────
const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

const milkIcon = (t) => t === "cow" ? "" : t === "buffalo" ? "" : "";

const milkBadge = (t) =>
    t === "cow" ? "bg-amber-50 text-amber-700 border border-amber-100"
        : t === "buffalo" ? "bg-blue-50 text-blue-700 border border-blue-100"
            : "bg-violet-50 text-violet-700 border border-violet-100";

const sellerTypeBadge = (t) =>
    t === "Utpadak"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
        : "bg-orange-50 text-orange-700 border border-orange-100";

// Add after the imports, before function InfoRow:
const MILK_TYPES = ["cow", "buffalo", "mixed"];
const SELLER_TYPES = ["Utpadak", "Gavali"];

const EMPTY_FORM = {
    seller_code: "", name: "", mobile: "", aadhaar: "",
    seller_type: "Utpadak", milk_type: "mixed", jamin: "",
    bank_account: "", bank_name: "", ifsc_code: "", address: "",
    advance_enabled: 1, advance_deduction: "", deposit_enabled: 0,
    deposit_per_litre: "", bank_account_confirm: "",
    product_sale_enabled: 0, product_sale_rate: "", is_active: 1,
};

const Field = ({ label, required, children }) => (
    <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        {children}
    </div>
);

// ── InfoRow ───────────────────────────────────────────────────
function InfoRow({ icon, label, value, mono = false, badge = null }) {
    return (
        <div className="flex items-start gap-3 py-3 border-b border-gray-50 last:border-0">
            <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0 mt-0.5">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{label}</p>
                {badge ?? (
                    value
                        ? <p className={`text-sm text-gray-800 ${mono ? "font-mono" : "font-medium"} break-all`}>{value}</p>
                        : <p className="text-sm text-gray-300 italic">No data</p>
                )}
            </div>
        </div>
    );
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, icon, children }) {
    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <div className="text-gray-500">{icon}</div>
                <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
            </div>
            <div className="px-5 py-1">{children}</div>
        </div>
    );
}

// ── StatCard ─────────────────────────────────────────────────
function StatCard({ label, value, sub, color }) {
    return (
        <div className={`rounded-xl border px-4 py-3 ${color}`}>
            <p className="text-xs text-gray-400 leading-none">{label}</p>
            <p className="text-xl font-bold text-gray-900 leading-tight mt-1">{value ?? <span className="text-gray-300 text-sm font-normal">No data</span>}</p>
            {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    );
}

// ── EmptyState ────────────────────────────────────────────────
function EmptyState({ icon, msg }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-300">
            <div className="text-3xl">{icon}</div>
            <p className="text-sm">{msg}</p>
        </div>
    );
}

// ── FilterBar ─────────────────────────────────────────────────
function FilterBar({ filter, setFilter, from, setFrom, to, setTo, onReset }) {
    const presets = ["all", "day", "week", "month", "year", "custom"];
    return (
        <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-50">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                {presets.map(p => (
                    <button key={p} onClick={() => { setFilter(p); onReset(); }}
                        className={`px-3 py-1.5 capitalize transition
                            ${filter === p ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                        {p}
                    </button>
                ))}
            </div>
            {filter === "custom" && (
                <div className="flex items-center gap-2">
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                    <span className="text-gray-400 text-xs">→</span>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)}
                        className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
                </div>
            )}
        </div>
    );
}

// ── Paginator ─────────────────────────────────────────────────
function Paginator({ total, page, setPage, pageSize, setPageSize }) {
    const totalPages = Math.ceil(total / pageSize);
    if (total === 0) return null;
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-50">
            <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                    ← Prev
                </button>
                <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                        .reduce((acc, p, idx, arr) => {
                            if (idx > 0 && p - arr[idx - 1] > 1) acc.push("...");
                            acc.push(p);
                            return acc;
                        }, [])
                        .map((p, i) => p === "..."
                            ? <span key={`d${i}`} className="px-1 text-xs text-gray-400">…</span>
                            : <button key={p} onClick={() => setPage(p)}
                                className={`w-7 h-7 rounded-lg text-xs font-semibold transition border
                                    ${page === p ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}>
                                {p}
                            </button>
                        )}
                </div>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                    Next →
                </button>
                <span className="text-xs text-gray-400 ml-1">
                    {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} of {total}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Rows:</span>
                <input type="number" min={1} max={total || 1} value={pageSize}
                    onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setPage(1); }}
                    className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function SellerProfile() {
    const { seller_id: id } = useParams();
    const navigate = useNavigate();

    const [seller, setSeller] = useState(null);
    const [milkEntries, setMilkEntries] = useState([]);
    const [premiumRates, setPremiumRates] = useState([]);
    const [cashAdvances, setCashAdvances] = useState([]);
    const [cashDeposits, setCashDeposits] = useState([]);
    const [depositBalance, setDepositBalance] = useState(null);
    const [productSales, setProductSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showEdit, setShowEdit] = useState(false);
    const [editForm, setEditForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [flash, setFlash] = useState(null);

    // ── Filter & Pagination State ──────────────────────────────
    const [milkFilter, setMilkFilter] = useState("all");
    const [milkFrom, setMilkFrom] = useState("");
    const [milkTo, setMilkTo] = useState("");
    const [milkPage, setMilkPage] = useState(1);
    const [milkPageSize, setMilkPageSize] = useState(10);

    const [advFilter, setAdvFilter] = useState("all");
    const [advFrom, setAdvFrom] = useState("");
    const [advTo, setAdvTo] = useState("");
    const [advPage, setAdvPage] = useState(1);
    const [advPageSize, setAdvPageSize] = useState(10);

    const [prodFilter, setProdFilter] = useState("all");
    const [prodFrom, setProdFrom] = useState("");
    const [prodTo, setProdTo] = useState("");
    const [prodPage, setProdPage] = useState(1);
    const [prodPageSize, setProdPageSize] = useState(10);

    const [premPage, setPremPage] = useState(1);
    const [premPageSize, setPremPageSize] = useState(10);

    const [depFilter, setDepFilter] = useState("all");
    const [depFrom, setDepFrom] = useState("");
    const [depTo, setDepTo] = useState("");
    const [depPage, setDepPage] = useState(1);
    const [depPageSize, setDepPageSize] = useState(10);

    const applyDateFilter = (entries, filter, customFrom, customTo, dateField = "entry_date") => {
        const now = new Date();
        let from, to;
        if (filter === "custom") {
            from = customFrom ? new Date(customFrom) : null;
            to = customTo ? new Date(customTo + "T23:59:59") : null;
        } else if (filter === "day") {
            from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        } else if (filter === "week") {
            const day = now.getDay();
            from = new Date(now); from.setDate(now.getDate() - day);
            to = new Date(now);
        } else if (filter === "month") {
            from = new Date(now.getFullYear(), now.getMonth(), 1);
            to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        } else if (filter === "year") {
            from = new Date(now.getFullYear(), 0, 1);
            to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
        } else {
            return entries;
        }
        return entries.filter(e => {
            // Parse date-only fields safely to avoid timezone shift
            const raw = e[dateField];
            const d = raw && raw.length === 10
                ? new Date(raw + "T12:00:00")  // date-only: use noon to avoid TZ issues
                : new Date(raw);
            return (!from || d >= from) && (!to || d <= to);
        });
    };

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const openEdit = () => {
        setEditForm({
            seller_code: seller.seller_code || "",
            name: seller.name || "",
            mobile: seller.mobile || "",
            aadhaar: seller.aadhaar || "",
            seller_type: seller.seller_type || "Utpadak",
            milk_type: seller.milk_type || "mixed",
            jamin: seller.jamin || "",
            bank_account: seller.bank_account || "",
            bank_account_confirm: seller.bank_account || "",
            bank_name: seller.bank_name || "",
            ifsc_code: seller.ifsc_code || "",
            address: seller.address || "",
            advance_enabled: seller.advance_enabled ?? 1,
            advance_deduction: seller.advance_deduction || "",
            deposit_enabled: seller.deposit_enabled ?? 0,
            deposit_per_litre: seller.deposit_per_litre || "",
            product_sale_enabled: seller.product_sale_enabled ?? 0,
            product_sale_rate: seller.product_sale_rate || "",
            is_active: seller.is_active ?? 1,
        });
        setShowEdit(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const nameParts = editForm.name.trim().split(/\s+/);
        if (!editForm.name || nameParts.length < 2) { showFlash("error", "Full name must include first and surname."); return; }
        if (/\d/.test(editForm.name)) { showFlash("error", "Name must not contain numbers."); return; }
        const mobileClean = editForm.mobile.replace(/^\+/, "");
        if (!/^\d{10,12}$/.test(mobileClean)) { showFlash("error", "Mobile must be 10–12 digits."); return; }
        if (editForm.bank_account && editForm.bank_account !== editForm.bank_account_confirm) {
            showFlash("error", "Bank account numbers do not match."); return;
        }
        setSaving(true);
        try {
            await api.put(`/sellers/${id}`, editForm);
            showFlash("success", "Seller updated successfully!");
            setShowEdit(false);
            await fetchAll();
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to save.");
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const { data } = await api.delete(`/sellers/${id}`);
            if (data.soft_deleted) {
                setShowDelete(false);
                setDeleting(false);
                showFlash("success", "Seller has linked records — marked as Inactive instead of deleted.");
                await fetchAll();
            } else {
                navigate("/sellerregister");
            }
        } catch (err) {
            showFlash("error", err.response?.data?.error || "Failed to delete.");
            setDeleting(false);
            setShowDelete(false);
        }
    };

    const fetchAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [sellerRes, entriesRes, premiumRes, cashRes, depRes, productsRes, depBalRes] = await Promise.allSettled([
                api.get(`/sellers/${id}`),
                api.get(`/sellers/${id}/entries`),
                api.get(`/sellers/${id}/premium`),
                api.get(`/sellers/${id}/advance`),
                api.get(`/sellers/${id}/deposit`),
                api.get(`/sellers/${id}/products`),
                api.get(`/sellers/${id}/deposit-balance`),
            ]);

            if (sellerRes.status === "fulfilled") setSeller(sellerRes.value.data);
            else { setError("Seller not found."); setLoading(false); return; }

            if (entriesRes.status === "fulfilled") setMilkEntries(entriesRes.value.data);
            if (premiumRes.status === "fulfilled") setPremiumRates(premiumRes.value.data);
            if (cashRes.status === "fulfilled") setCashAdvances(cashRes.value.data);
            if (depRes.status === "fulfilled") setCashDeposits(depRes.value.data);
            if (productsRes.status === "fulfilled") setProductSales(productsRes.value.data);
            if (depBalRes.status === "fulfilled") setDepositBalance(depBalRes.value.data);
        } catch {
            setError("Failed to load seller data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [id]);

    // ── derived stats ──
    // ── derived stats (all-time, for summary cards) ──
    const totalMilk = milkEntries.reduce((a, e) => a + parseFloat(e.quantity || 0), 0);
    const totalEarned = milkEntries.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0);
    const avgFat = milkEntries.length ? (milkEntries.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / milkEntries.length).toFixed(2) : null;
    const avgSnf = milkEntries.length ? (milkEntries.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / milkEntries.length).toFixed(2) : null;
    const totalAdvance = cashAdvances.filter(c => c.type === "given").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
    const totalRepaid = cashAdvances.filter(c => c.type === "received").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
    const totalProducts = productSales.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
    const depositNet = depositBalance?.net_balance ??
        (cashDeposits.filter(d => d.type === "credit").reduce((a, d) => a + parseFloat(d.amount || 0), 0) -
            cashDeposits.filter(d => d.type === "debit").reduce((a, d) => a + parseFloat(d.amount || 0), 0));

    if (loading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (error) return (
        <div className="min-h-screen bg-[#f5f4f0] flex flex-col items-center justify-center gap-4">
            <AlertTriangle size={32} className="text-rose-400" />
            <p className="text-gray-600 font-medium">{error}</p>
            <button onClick={() => navigate(-1)} className="text-sm text-gray-500 underline">Go back</button>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* ── Breadcrumb + Header ── */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Link to="/operator/sellerregister" className="hover:text-gray-600 transition">Sellers</Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-600 font-medium">{seller.name}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm">
                            <ArrowLeft size={16} />
                        </button>

                        {/* Avatar */}
                        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-gray-200">
                            {seller.name?.charAt(0)?.toUpperCase()}
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900">{seller.name}</h1>
                                {seller.seller_type && (
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${sellerTypeBadge(seller.seller_type)}`}>
                                        {seller.seller_type === "Utpadak" ? "" : ""} {seller.seller_type}
                                    </span>
                                )}
                                {seller.milk_type && (
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${milkBadge(seller.milk_type)}`}>
                                        {milkIcon(seller.milk_type)} {seller.milk_type}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400 mt-0.5">
                                Code: <span className="font-mono text-gray-600">{seller.seller_code || "—"}</span>
                                {seller.created_at && <> · Registered {fmt(seller.created_at)}</>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={openEdit}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition shadow-sm">
                            <Pencil size={13} /> Edit Seller
                        </button>
                        <button onClick={() => setShowDelete(true)}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition shadow-sm">
                            <Trash2 size={13} /> Delete
                        </button>
                    </div>
                </div>
                
                {/* ── Summary Stats ── */}

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success" ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* Edit Form */}
                {showEdit && (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="font-semibold text-gray-800">Edit Seller</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Update seller details below</p>
                            </div>
                            <button onClick={() => setShowEdit(false)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {/* Row 1 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label="Full Name" required>
                                    <input value={editForm.name}
                                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                        placeholder="e.g. Ramesh Patil" required maxLength={60}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label="Seller Code">
                                    <input value={editForm.seller_code} readOnly
                                        className="border border-gray-200 bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-500 font-mono cursor-not-allowed w-full" />
                                </Field>
                                <Field label="Mobile" required>
                                    <input value={editForm.mobile}
                                        onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value.replace(/(?!^\+)[^\d]/g, "").slice(0, 13) }))}
                                        placeholder="+91XXXXXXXXXX" type="tel" required maxLength={13}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                            </div>
                            {/* Row 2 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label="Aadhaar">
                                    <input value={editForm.aadhaar}
                                        onChange={e => setEditForm(p => ({ ...p, aadhaar: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                                        placeholder="XXXX XXXX XXXX" maxLength={12}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label="Seller Type" required>
                                    <div className="flex gap-2">
                                        {SELLER_TYPES.map(t => (
                                            <label key={t} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.seller_type === t ? t === "Utpadak" ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-orange-50 border-orange-300 text-orange-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.seller_type === t}
                                                    onChange={() => setEditForm(p => ({ ...p, seller_type: t }))} className="hidden" />
                                                {t}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                                <Field label="Milk Type" required>
                                    <div className="flex gap-2">
                                        {MILK_TYPES.map(t => (
                                            <label key={t} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.milk_type === t ? t === "cow" ? "bg-amber-50 border-amber-300 text-amber-800" : t === "buffalo" ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-violet-50 border-violet-300 text-violet-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.milk_type === t}
                                                    onChange={() => setEditForm(p => ({ ...p, milk_type: t }))} className="hidden" />
                                                {t.charAt(0).toUpperCase() + t.slice(1)}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                            {/* Row 3 — Bank */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <Field label="Jamin (Guarantor)">
                                    <input value={editForm.jamin}
                                        onChange={e => setEditForm(p => ({ ...p, jamin: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                        placeholder="Name & Surname" maxLength={60}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label="Bank Account No.">
                                    <input value={editForm.bank_account}
                                        onChange={e => setEditForm(p => ({ ...p, bank_account: e.target.value.replace(/\D/g, "") }))}
                                        placeholder="Min 10 digits" maxLength={20}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label="Confirm Account No.">
                                    <input value={editForm.bank_account_confirm}
                                        onChange={e => setEditForm(p => ({ ...p, bank_account_confirm: e.target.value.replace(/\D/g, "") }))}
                                        placeholder="Re-enter" maxLength={20}
                                        className={`border rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black transition w-full
                                            ${editForm.bank_account_confirm && editForm.bank_account !== editForm.bank_account_confirm ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus:bg-white"}`} />
                                    {editForm.bank_account_confirm && editForm.bank_account !== editForm.bank_account_confirm &&
                                        <p className="text-xs text-red-500 mt-1">Account numbers do not match</p>}
                                </Field>
                                <Field label="Bank Name">
                                    <input value={editForm.bank_name}
                                        onChange={e => setEditForm(p => ({ ...p, bank_name: e.target.value.replace(/[^a-zA-Z\s.]/g, "") }))}
                                        placeholder="e.g. SBI, HDFC" maxLength={50}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label="IFSC Code">
                                    <input value={editForm.ifsc_code}
                                        onChange={e => setEditForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                                        placeholder="e.g. SBIN0001234" maxLength={11}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                            </div>
                            {/* Address */}
                            <Field label="Address">
                                <input value={editForm.address}
                                    onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                                    placeholder="Village / City / District" maxLength={200}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{editForm.address.length}/200</p>
                            </Field>
                            {/* Advance + Deposit + Product + Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Cash Advance">
                                    <div className="flex gap-2">
                                        {[{ label: "✓ Enabled", val: 1 }, { label: "✗ Disabled", val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.advance_enabled === val ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.advance_enabled === val}
                                                    onChange={() => setEditForm(p => ({ ...p, advance_enabled: val }))} className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                                {editForm.advance_enabled === 1 && (
                                    <Field label="Advance Recovery (₹/cycle)">
                                        <input value={editForm.advance_deduction}
                                            onChange={e => setEditForm(p => ({ ...p, advance_deduction: e.target.value.replace(/[^0-9.]/g, "") }))}
                                            placeholder="e.g. 500" inputMode="decimal" maxLength={10}
                                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                    </Field>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Deposit per Litre">
                                    <div className="flex gap-2">
                                        {[{ label: "✓ Enabled", val: 1 }, { label: "✗ Disabled", val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.deposit_enabled === val ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.deposit_enabled === val}
                                                    onChange={() => setEditForm(p => ({ ...p, deposit_enabled: val, deposit_per_litre: val === 0 ? "" : p.deposit_per_litre }))} className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                                {editForm.deposit_enabled === 1 && (
                                    <Field label="Deposit Rate (₹/litre)">
                                        <input value={editForm.deposit_per_litre}
                                            onChange={e => setEditForm(p => ({ ...p, deposit_per_litre: e.target.value.replace(/[^0-9.]/g, "") }))}
                                            placeholder="e.g. 2.00" inputMode="decimal" maxLength={6}
                                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                    </Field>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Product Sale">
                                    <div className="flex gap-2">
                                        {[{ label: "✓ Enabled", val: 1 }, { label: "✗ Disabled", val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                    ${editForm.product_sale_enabled === val ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.product_sale_enabled === val}
                                                    onChange={() => setEditForm(p => ({ ...p, product_sale_enabled: val }))} className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label="Seller Status">
                                    <div className="flex gap-2">
                                        {[{ label: "✓ Active", val: 1 }, { label: "✗ Inactive", val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${(editForm.is_active ?? 1) === val ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={(editForm.is_active ?? 1) === val}
                                                    onChange={() => setEditForm(p => ({ ...p, is_active: val }))} className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={() => setShowEdit(false)}
                                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition">Cancel</button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl text-white bg-black hover:bg-gray-800 transition disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    <Save size={13} />
                                    {saving ? "Saving…" : "Update Seller"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
                {/* ── Summary Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard label="Total Milk (L)" value={milkEntries.length ? `${totalMilk.toFixed(1)} L` : null} sub={`${milkEntries.length} entries`} color="bg-blue-50 border-blue-100" />
                    <StatCard label="Total Earned" value={totalEarned ? `₹${totalEarned.toFixed(2)}` : null} sub="from milk entries" color="bg-emerald-50 border-emerald-100" />
                    <StatCard label="Deposit Balance" value={`₹${parseFloat(depositNet || 0).toFixed(2)}`} sub="net deposit" color="bg-sky-50 border-sky-100" />
                    <StatCard label="Cash Advance" value={totalAdvance ? `₹${totalAdvance.toFixed(2)}` : null} sub={`₹${totalRepaid.toFixed(2)} repaid`} color="bg-amber-50 border-amber-100" />
                    <StatCard label="Products Bought" value={totalProducts ? `₹${totalProducts.toFixed(2)}` : null} sub={`${productSales.length} transactions`} color="bg-violet-50 border-violet-100" />
                </div>

                {/* ── Two-column layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Personal Info */}
                    <Section title="Personal Information" icon={<User size={15} />}>
                        <InfoRow icon={<Phone size={13} />} label="Mobile" value={seller.mobile} mono />
                        <InfoRow icon={<CreditCard size={13} />} label="Aadhaar" value={seller.aadhaar} mono />
                        <InfoRow icon={<User size={13} />} label="Jamin (Guarantor)" value={seller.jamin} />
                        <InfoRow icon={<MapPin size={13} />} label="Address" value={seller.address} />
                        <InfoRow icon={<Calendar size={13} />} label="Registered On" value={fmtDateTime(seller.created_at)} />
                        <InfoRow icon={<User size={13} />} label="Seller Type" badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${sellerTypeBadge(seller.seller_type)}`}>
                                {seller.seller_type || "—"}
                            </span>
                        } />
                        <InfoRow icon={<Milk size={13} />} label="Milk Type" badge={
                            seller.milk_type
                                ? <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${milkBadge(seller.milk_type)}`}>
                                    {seller.milk_type}
                                </span>
                                : null
                        } />
                        <InfoRow icon={<Banknote size={13} />} label="Cash Advance" badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
                                ${seller.advance_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                                {seller.advance_enabled ? "Enabled" : "Disabled"}
                            </span>
                        } />
                        {seller.advance_deduction && parseFloat(seller.advance_deduction) > 0 && (
                            <InfoRow icon={<Banknote size={13} />} label="Advance Recovery / Cycle"
                                value={`₹${parseFloat(seller.advance_deduction).toFixed(2)}`} mono />
                        )}
                        {Boolean(seller.deposit_enabled) && seller.deposit_per_litre && (
                            <InfoRow
                                icon={<Banknote size={13} />}
                                label="Deposit per Litre"
                                value={`₹${parseFloat(seller.deposit_per_litre).toFixed(2)} / L`}
                                mono
                            />
                        )}
                        <InfoRow icon={<Star size={13} />} label="Status" badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
        ${seller.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                                {seller.is_active ? "Active" : "Inactive"}
                            </span>
                        } />
                        <InfoRow icon={<ShoppingBag size={13} />} label="Product Sale" badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
        ${seller.product_sale_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                                {seller.product_sale_enabled ? "Enabled" : "Disabled"}
                            </span>
                        } />
                        {Boolean(seller.product_sale_enabled) && seller.product_sale_rate && (
                            <InfoRow icon={<ShoppingBag size={13} />} label="Product Sale Rate"
                                value={`₹${parseFloat(seller.product_sale_rate).toFixed(2)} / L`} mono />
                        )}
                    </Section>

                    {/* Bank Info */}
                    <Section title="Bank Details" icon={<Landmark size={15} />}>
                        <InfoRow icon={<Hash size={13} />} label="Account Number" value={seller.bank_account} mono />
                        <InfoRow icon={<Building2 size={13} />} label="Bank Name" value={seller.bank_name} />
                        <InfoRow icon={<BadgeCheck size={13} />} label="IFSC Code" value={seller.ifsc_code} mono />
                    </Section>
                </div>

                {/* ── Milk Entries ── */}
                {(() => {
                    const filtered = applyDateFilter(milkEntries, milkFilter, milkFrom, milkTo, "entry_date");
                    const paginated = filtered.slice((milkPage - 1) * milkPageSize, milkPage * milkPageSize);
                    const fAvgFat = filtered.length ? (filtered.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / filtered.length).toFixed(2) : null;
                    const fAvgSnf = filtered.length ? (filtered.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / filtered.length).toFixed(2) : null;
                    return (
                        <Section title="Milk Entries" icon={<Milk size={15} />}>
                            <FilterBar filter={milkFilter} setFilter={setMilkFilter}
                                from={milkFrom} setFrom={setMilkFrom}
                                to={milkTo} setTo={setMilkTo}
                                onReset={() => setMilkPage(1)} />
                            {filtered.length > 0 && (() => {
                                const fTotalQty = filtered.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2);
                                const fTotalAmt = filtered.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0).toFixed(2);
                                const fCowQty = filtered.filter(e => (e.milk_type || "").toLowerCase() === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2);
                                const fBufQty = filtered.filter(e => (e.milk_type || "").toLowerCase() === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2);
                                return (
                                    <div className="flex flex-wrap gap-2 py-3 border-b border-gray-50">
                                        <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">Avg FAT: {fAvgFat}%</span>
                                        <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">Avg SNF: {fAvgSnf}%</span>
                                        <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">{filtered.length} records</span>
                                        <span className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium">Total: {fTotalQty} L</span>
                                        {parseFloat(fCowQty) > 0 && <span className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium"> Cow: {fCowQty} L</span>}
                                        {parseFloat(fBufQty) > 0 && <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium"> Buffalo: {fBufQty} L</span>}
                                        <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">₹{fTotalAmt}</span>
                                    </div>
                                );
                            })()}
                            {filtered.length === 0 ? (
                                <EmptyState icon="" msg="No milk entries for this period" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[420px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Date", "Shift", "Milk", "Qty (L)", "FAT", "SNF", "Water%", "Rate", "Amount", "Premium"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map((e) => (
                                                    <tr key={e.entry_id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{fmt(e.entry_date) || "—"}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${e.shift === "morning" ? "bg-yellow-50 text-yellow-700 border border-yellow-100" : "bg-indigo-50 text-indigo-700 border border-indigo-100"}`}>
                                                                {e.shift || "—"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            {e.milk_type ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${milkBadge(e.milk_type)}`}>{milkIcon(e.milk_type)} {e.milk_type}</span> : "—"}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-700 font-medium">{e.quantity ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-blue-600">{e.fat ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-emerald-600">{e.snf ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-500">{e.water ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">₹{parseFloat(e.rate_applied || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(e.total_amount || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5">
                                                            {e.is_premium
                                                                ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100"> Premium</span>
                                                                : <span className="text-gray-300 text-xs">—</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={filtered.length} page={milkPage} setPage={setMilkPage}
                                pageSize={milkPageSize} setPageSize={setMilkPageSize} />
                        </Section>
                    );
                })()}

                {/* ── Premium Rates ── */}
                {(() => {
                    const paginated = premiumRates.slice((premPage - 1) * premPageSize, premPage * premPageSize);
                    return (
                        <Section title="Premium Rates Assigned" icon={<FlaskConical size={15} />}>
                            {premiumRates.length === 0 ? (
                                <EmptyState icon="" msg="No premium rates assigned" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Milk Type", "Rate / L", "From", "To", "Reason", "Status"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map((r) => (
                                                    <tr key={r.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${milkBadge(r.milk_type)}`}>
                                                                {milkIcon(r.milk_type)} {r.milk_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900 font-mono">₹{parseFloat(r.rate_per_liter).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(r.effective_from) || "—"}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(r.effective_to) || <span className="text-emerald-600 font-medium">Active</span>}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">{r.reason || "—"}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-gray-50 text-gray-400 border border-gray-100"}`}>
                                                                {r.is_active ? "Active" : "Inactive"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={premiumRates.length} page={premPage} setPage={setPremPage}
                                pageSize={premPageSize} setPageSize={setPremPageSize} />
                        </Section>
                    );
                })()}
                {/* ── Cash Advances ── */}
                {(() => {
                    const filtered = applyDateFilter(cashAdvances, advFilter, advFrom, advTo, "transaction_date");
                    const paginated = filtered.slice((advPage - 1) * advPageSize, advPage * advPageSize);
                    const fGiven = filtered.filter(c => c.type === "given").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
                    const fReceived = filtered.filter(c => c.type === "received").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
                    return (
                        <Section title="Cash Advances" icon={<Wallet size={15} />}>
                            <FilterBar filter={advFilter} setFilter={setAdvFilter}
                                from={advFrom} setFrom={setAdvFrom}
                                to={advTo} setTo={setAdvTo}
                                onReset={() => setAdvPage(1)} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1 rounded-full font-medium">Given: ₹{fGiven.toFixed(2)}</span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">Received: ₹{fReceived.toFixed(2)}</span>
                                    <span className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">Balance: ₹{(fGiven - fReceived).toFixed(2)}</span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon="💰" msg="No cash advance records for this period" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Date", "Type", "Amount", "Remarks"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map((c) => (
                                                    <tr key={c.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(c.transaction_date) || "—"}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.type === "given" ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"}`}>
                                                                {c.type === "given" ? "↑ Given" : "↓ Received"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-bold font-mono text-gray-900">₹{parseFloat(c.amount).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500">{c.remarks || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={filtered.length} page={advPage} setPage={setAdvPage}
                                pageSize={advPageSize} setPageSize={setAdvPageSize} />
                        </Section>
                    );
                })()}

                {/*Cash Deposits*/}
                {(() => {
                    const filtered = applyDateFilter(cashDeposits, depFilter, depFrom, depTo, "transaction_date");
                    const paginated = filtered.slice((depPage - 1) * depPageSize, depPage * depPageSize);
                    const fCredit = filtered.filter(c => c.type === "credit").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
                    const fDebit = filtered.filter(c => c.type === "debit").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
                    const fNet = fCredit - fDebit;                    return (
                        <Section title="Cash Deposits" icon={<Vault size={15} />}>
                            <FilterBar filter={depFilter} setFilter={setDepFilter} from={depFrom} setFrom={setDepFrom} to={depTo} setTo={setDepTo} onReset={() => setDepPage(1)} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 flex-wrap py-3 border-b border-gray-50">
                                    <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">{filtered.length} records</span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">Credited: ₹{fCredit.toFixed(2)}</span>
                                    <span className="text-xs bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1 rounded-full font-medium">Debited: ₹{fDebit.toFixed(2)}</span>
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${fNet >= 0 ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
                                        Net: ₹{fNet.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon="🏦" msg="No cash deposit records for this period" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                        {["Date", "Type", "Amount", "Remarks"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map((c) => (
                                                    <tr key={c.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(c.transaction_date) || "—"}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${c.type === "credit" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                                                                {c.type === "credit" ? "↑ Credit" : "↓ Debit"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-bold font-mono text-gray-900">₹{parseFloat(c.amount).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500">{c.remarks || "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={filtered.length} page={depPage} setPage={setDepPage}
                                pageSize={depPageSize} setPageSize={setDepPageSize} />
                        </Section>
                    );
                })()}

                {/* ── Product Sales ── */}
                {(() => {
                    const filtered = applyDateFilter(productSales, prodFilter, prodFrom, prodTo, "sale_date");
                    const paginated = filtered.slice((prodPage - 1) * prodPageSize, prodPage * prodPageSize);
                    const fTotal = filtered.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
                    return (
                        <Section title="Products Purchased" icon={<ShoppingBag size={15} />}>
                            <FilterBar filter={prodFilter} setFilter={setProdFilter}
                                from={prodFrom} setFrom={setProdFrom}
                                to={prodTo} setTo={setProdTo}
                                onReset={() => setProdPage(1)} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">{filtered.length} transactions</span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">Total: ₹{fTotal.toFixed(2)}</span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon="📦" msg="No product purchases for this period" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Date", "Product", "Qty", "Rate", "Amount"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map((p) => (
                                                    <tr key={p.sale_id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(p.sale_date) || "—"}</td>
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">{p.product_name || p.product_id || "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">{p.quantity} {p.unit || ""}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">₹{parseFloat(p.rate).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(p.total_amount).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={filtered.length} page={prodPage} setPage={setProdPage}
                                pageSize={prodPageSize} setPageSize={setProdPageSize} />
                        </Section>
                    );
                })()}



            </main>
            {/* Delete Modal */}
            {showDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                                <Trash2 size={22} className="text-red-500" />
                            </div>
                            <h2 className="text-gray-800 font-semibold text-base">Delete Seller?</h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                <span className="font-semibold text-gray-700">"{seller.name}"</span> will be permanently removed.
                                If this seller has linked milk entries or transactions, they will be <span className="font-semibold text-amber-600">marked as Inactive</span> instead.
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setShowDelete(false)} disabled={deleting}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                Cancel
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-100 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                                {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {deleting ? "Deleting…" : "Yes, Delete"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}