import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft, User, Phone, CreditCard, MapPin, Landmark,
    Building2, Hash, Calendar, RefreshCw, AlertTriangle,
    FlaskConical, Milk, TrendingUp, Wallet, ShoppingBag,
    Clock, ChevronRight, BadgeCheck, Pencil, Trash2, Save,
    X, Banknote, Star, Vault, Droplet, Package, Lock,
    Percent, Receipt, Gift, Wheat, BarChart3,
} from "lucide-react";
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip as RechartsTooltip,
} from "recharts";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

// ── helpers ───────────────────────────────────────────────────
const fmt = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null;

const fmtDateTime = (d) =>
    d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

// groups raw milk entries by entry_date and computes per-day aggregates for the chart
const buildMilkChartData = (entries) => {
    const map = {};
    entries.forEach((e) => {
        const key = e.entry_date ? String(e.entry_date).slice(0, 10) : "unknown";
        if (!map[key]) {
            map[key] = { date: key, quantity: 0, amount: 0, fatSum: 0, snfSum: 0, cowQty: 0, bufQty: 0, count: 0 };
        }
        const qty = parseFloat(e.quantity || 0);
        map[key].quantity += qty;
        map[key].amount += parseFloat(e.total_amount || 0);
        map[key].fatSum += parseFloat(e.fat || 0);
        map[key].snfSum += parseFloat(e.snf || 0);
        if ((e.milk_type || "").toLowerCase() === "cow") map[key].cowQty += qty;
        if ((e.milk_type || "").toLowerCase() === "buffalo") map[key].bufQty += qty;
        map[key].count += 1;
    });
    return Object.values(map)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((d) => ({
            ...d,
            label: fmt(d.date) || d.date,
            quantity: parseFloat(d.quantity.toFixed(2)),
            amount: parseFloat(d.amount.toFixed(2)),
            avgFat: (d.fatSum / d.count).toFixed(2),
            avgSnf: (d.snfSum / d.count).toFixed(2),
        }));
};

const milkIcon = (t, iconMap) => {
    if (!iconMap) return null;
    return t === "cow" ? iconMap.cow : t === "buffalo" ? iconMap.buffalo : iconMap.mixed;
};

const milkBadge = (t) =>
    t === "cow" ? "bg-amber-50 text-amber-700 border border-amber-100"
        : t === "buffalo" ? "bg-blue-50 text-blue-700 border border-blue-100"
            : "bg-violet-50 text-violet-700 border border-violet-100";

const sellerTypeBadge = (t) =>
    t === "Utpadak"
        ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
        : "bg-orange-50 text-orange-700 border border-orange-100";

const MILK_TYPES = ["cow", "buffalo", "mixed"];
const SELLER_TYPES = ["Utpadak", "Gavali"];

const EMPTY_FORM = {
    seller_code: "", name: "", mobile: "", aadhaar: "",
    seller_type: "Utpadak", milk_type: "mixed", jamin: "",
    bank_account: "", bank_name: "", ifsc_code: "", address: "",
    advance_enabled: 1, advance_deduction: "", deposit_enabled: 0,
    deposit_per_litre: "", bank_account_confirm: "",
    product_sale_enabled: 0, product_sale_rate: "",
    cattle_feed_sale_enabled: 0,
    payment_term: "postpaid",
    is_active: 1,
    password: "",
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
function FilterBar({ filter, setFilter, from, setFrom, to, setTo, onReset, t }) {
    const presets = ["all", "day", "week", "month", "year", "custom"];
    const labels = {
        all: t('sellerProfile.filterBar.all'),
        day: t('sellerProfile.filterBar.day'),
        week: t('sellerProfile.filterBar.week'),
        month: t('sellerProfile.filterBar.month'),
        year: t('sellerProfile.filterBar.year'),
        custom: t('sellerProfile.filterBar.custom'),
    };
    return (
        <div className="flex flex-wrap items-center gap-2 py-3 border-b border-gray-50">
            <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                {presets.map(p => (
                    <button key={p} onClick={() => { setFilter(p); onReset(); }}
                        className={`px-3 py-1.5 capitalize transition
                            ${filter === p ? "bg-gray-900 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}>
                        {labels[p]}
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

// ── MilkChartTooltip ──────────────────────────────────────────
function MilkChartTooltip({ active, payload, label }) {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0].payload;
    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3.5 py-3 text-xs min-w-[170px]">
            <p className="font-semibold text-gray-800 mb-2">{label}</p>
            <div className="space-y-1.5">
                <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Quantity</span>
                    <span className="font-mono font-semibold text-blue-600">{d.quantity.toFixed(2)} L</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Entries</span>
                    <span className="font-mono font-semibold text-gray-700">{d.count}</span>
                </div>
                {d.cowQty > 0 && (
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Cow</span>
                        <span className="font-mono font-semibold text-amber-600">{d.cowQty.toFixed(2)} L</span>
                    </div>
                )}
                {d.bufQty > 0 && (
                    <div className="flex justify-between gap-4">
                        <span className="text-gray-400">Buffalo</span>
                        <span className="font-mono font-semibold text-blue-500">{d.bufQty.toFixed(2)} L</span>
                    </div>
                )}
                <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Avg Fat</span>
                    <span className="font-mono font-semibold text-amber-600">{d.avgFat}</span>
                </div>
                <div className="flex justify-between gap-4">
                    <span className="text-gray-400">Avg SNF</span>
                    <span className="font-mono font-semibold text-emerald-600">{d.avgSnf}</span>
                </div>
                <div className="flex justify-between gap-4 pt-1.5 border-t border-gray-100">
                    <span className="text-gray-400">Amount</span>
                    <span className="font-mono font-bold text-gray-900">₹{d.amount.toFixed(2)}</span>
                </div>
            </div>
        </div>
    );
}

// ── Paginator ─────────────────────────────────────────────────
function Paginator({ total, page, setPage, pageSize, setPageSize, t }) {
    const totalPages = Math.ceil(total / pageSize);
    if (total === 0) return null;
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-gray-50">
            <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition">
                    {t('sellerProfile.paginator.prev')}
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
                    {t('sellerProfile.paginator.next')}
                </button>
                <span className="text-xs text-gray-400 ml-1">
                    {total === 0 ? "0" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`} {t('sellerProfile.paginator.of')} {total}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{t('sellerProfile.paginator.rows')}</span>
                <input type="number" min={1} max={total || 1} value={pageSize}
                    onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setPage(1); }}
                    className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition" />
            </div>
        </div>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function SellerProfile() {
    const { t } = useTranslation();
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
    const [hasPassword, setHasPassword] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [flash, setFlash] = useState(null);

    // ── Filter & Pagination State ──────────────────────────────
    const [milkFilter, setMilkFilter] = useState("all");
    const [milkFrom, setMilkFrom] = useState("");
    const [milkTo, setMilkTo] = useState("");
    const [milkPage, setMilkPage] = useState(1);
    const [milkPageSize, setMilkPageSize] = useState(10);

    const [chartFilter, setChartFilter] = useState("month");
    const [chartFrom, setChartFrom] = useState("");
    const [chartTo, setChartTo] = useState("");

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

    const [commissionData, setCommissionData] = useState(null);

    const [bills, setBills] = useState([]);
    const [billFilter, setBillFilter] = useState("all");
    const [billFrom, setBillFrom] = useState("");
    const [billTo, setBillTo] = useState("");
    const [billPage, setBillPage] = useState(1);
    const [billPageSize, setBillPageSize] = useState(10);

    const [bonusData, setBonusData] = useState({ bonus: [], gavaliBonus: [] });
    const [bonusPage, setBonusPage] = useState(1);
    const [bonusPageSize, setBonusPageSize] = useState(10);

    const [cattleFeedSales, setCattleFeedSales] = useState([]);
    const [cfFilter, setCfFilter] = useState("all");
    const [cfFrom, setCfFrom] = useState("");
    const [cfTo, setCfTo] = useState("");
    const [cfPage, setCfPage] = useState(1);
    const [cfPageSize, setCfPageSize] = useState(10);

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
            const raw = e[dateField];
            const d = raw && raw.length === 10
                ? new Date(raw + "T12:00:00")
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
            cattle_feed_sale_enabled: seller.cattle_feed_sale_enabled ?? 0,
            payment_term: seller.payment_term || "postpaid",
            is_active: seller.is_active ?? 1,
            password: "",
        });
        setHasPassword(!!seller.has_password);
        setShowEdit(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const nameParts = editForm.name.trim().split(/\s+/);
        if (!editForm.name || nameParts.length < 2) { showFlash("error", t('sellerProfile.editForm.nameRequired')); return; }
        if (/\d/.test(editForm.name)) { showFlash("error", t('sellerProfile.editForm.nameNoNumbers')); return; }
        const mobileClean = editForm.mobile.replace(/^\+/, "");
        if (!/^\d{10,12}$/.test(mobileClean)) { showFlash("error", t('sellerProfile.editForm.mobileInvalid')); return; }
        if (editForm.bank_account && editForm.bank_account !== editForm.bank_account_confirm) {
            showFlash("error", t('sellerProfile.editForm.bankMismatch')); return;
        }
        if (editForm.password && editForm.password.length < 6) {
            showFlash("error", t('sellerProfile.editForm.passwordMinError') || "Password must be at least 6 characters.");
            return;
        }
        setSaving(true);
        try {
            const payload = { ...editForm };
            if (!payload.password) delete payload.password;
            await api.put(`/sellers/${id}`, payload);
            showFlash("success", t('sellerProfile.editForm.saveSuccess'));
            setShowEdit(false);
            await fetchAll();
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('sellerProfile.editForm.saveError'));
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const { data } = await api.delete(`/sellers/${id}`);
            if (data.soft_deleted) {
                setShowDelete(false);
                setDeleting(false);
                showFlash("success", t('sellerProfile.deleteModal.softDeleteSuccess'));
                await fetchAll();
            } else {
                navigate("/sellerregister");
            }
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('sellerProfile.deleteModal.deleteError'));
            setDeleting(false);
            setShowDelete(false);
        }
    };

    const fetchAll = async () => {
        setLoading(true);
        setError(null);
        try {
            const [sellerRes, entriesRes, premiumRes, cashRes, depRes, productsRes, depBalRes,
                   commissionRes, billsRes, bonusRes, cattleFeedRes] = await Promise.allSettled([
                api.get(`/sellers/${id}`),
                api.get(`/sellers/${id}/entries`),
                api.get(`/sellers/${id}/premium`),
                api.get(`/sellers/${id}/advance`),
                api.get(`/sellers/${id}/deposit`),
                api.get(`/sellers/${id}/products`),
                api.get(`/sellers/${id}/deposit-balance`),
                api.get(`/sellers/${id}/commission`),
                api.get(`/sellers/${id}/bills`),
                api.get(`/sellers/${id}/bonus`),
                api.get(`/sellers/${id}/cattle-feed`),
            ]);

            if (sellerRes.status === "fulfilled") setSeller(sellerRes.value.data);
            else { setError(t('sellerProfile.flash.notFound')); setLoading(false); return; }

            if (entriesRes.status === "fulfilled") setMilkEntries(entriesRes.value.data);
            if (premiumRes.status === "fulfilled") setPremiumRates(premiumRes.value.data);
            if (cashRes.status === "fulfilled") setCashAdvances(cashRes.value.data);
            if (depRes.status === "fulfilled") setCashDeposits(depRes.value.data);
            if (productsRes.status === "fulfilled") setProductSales(productsRes.value.data);
            if (depBalRes.status === "fulfilled") setDepositBalance(depBalRes.value.data);
            if (commissionRes.status === "fulfilled") setCommissionData(commissionRes.value.data);
            if (billsRes.status === "fulfilled") setBills(billsRes.value.data);
            if (bonusRes.status === "fulfilled") setBonusData(bonusRes.value.data);
            if (cattleFeedRes.status === "fulfilled") setCattleFeedSales(cattleFeedRes.value.data);
        } catch {
            setError(t('sellerProfile.flash.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAll(); }, [id]);

    // ── derived stats ──
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

    const milkTypeIcons = {
        cow: <Milk className="w-3 h-3 text-amber-600" />,
        buffalo: <Milk className="w-3 h-3 text-blue-600" />,
        mixed: <Milk className="w-3 h-3 text-violet-600" />,
    };

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-full mx-auto px-4 sm:px-6 py-8 space-y-5">

                {/* ── Breadcrumb + Header ── */}
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Link to="/operator/sellerregister" className="hover:text-gray-600 transition">{t('sellerProfile.backToSellers')}</Link>
                    <ChevronRight size={12} />
                    <span className="text-gray-600 font-medium">{seller.name}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)}
                            className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 transition shadow-sm">
                            <ArrowLeft size={16} />
                        </button>

                        <div className="w-14 h-14 rounded-2xl bg-gray-900 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-gray-200">
                            {seller.name?.charAt(0)?.toUpperCase()}
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900">{seller.name}</h1>
                                {seller.seller_type && (
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${sellerTypeBadge(seller.seller_type)}`}>
                                        {seller.seller_type}
                                    </span>
                                )}
                                {seller.milk_type && (
                                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${milkBadge(seller.milk_type)}`}>
                                        {seller.milk_type}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-gray-400 mt-0.5">
                                {t('sellerProfile.sellerCode', { code: seller.seller_code || "—" })}
                                {seller.created_at && <> · {t('sellerProfile.registeredOn', { date: fmt(seller.created_at) })}</>}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={openEdit}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition shadow-sm">
                            <Pencil size={13} /> {t('sellerProfile.editSeller')}
                        </button>
                        <button onClick={() => setShowDelete(true)}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition shadow-sm">
                            <Trash2 size={13} /> {t('sellerProfile.deleteSeller')}
                        </button>
                    </div>
                </div>

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
                                <h2 className="font-semibold text-gray-800">{t('sellerProfile.editForm.title')}</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{t('sellerProfile.editForm.subtitle')}</p>
                            </div>
                            <button onClick={() => { setShowEdit(false); setHasPassword(false); }}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-5">
                            {/* Row 1 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label={t('sellerProfile.editForm.fullName')} required>
                                    <input value={editForm.name}
                                        onChange={e => setEditForm(p => ({ ...p, name: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                        placeholder={t('sellerProfile.editForm.fullNamePlaceholder')} required maxLength={60}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.sellerCode')}>
                                    <input value={editForm.seller_code} readOnly
                                        className="border border-gray-200 bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-500 font-mono cursor-not-allowed w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.mobile')} required>
                                    <input value={editForm.mobile}
                                        onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value.replace(/(?!^\+)[^\d]/g, "").slice(0, 13) }))}
                                        placeholder={t('sellerProfile.editForm.mobilePlaceholder')} type="tel" required maxLength={13}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                            </div>
                            {/* Row 2 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label={t('sellerProfile.editForm.aadhaar')}>
                                    <input value={editForm.aadhaar}
                                        onChange={e => setEditForm(p => ({ ...p, aadhaar: e.target.value.replace(/\D/g, "").slice(0, 12) }))}
                                        placeholder={t('sellerProfile.editForm.aadhaarPlaceholder')} maxLength={12}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.sellerType')} required>
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
                                <Field label={t('sellerProfile.editForm.milkType')} required>
                                    <div className="flex gap-2">
                                        {MILK_TYPES.map(mt => (
                                            <label key={mt} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.milk_type === mt ? mt === "cow" ? "bg-amber-50 border-amber-300 text-amber-800" : mt === "buffalo" ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-violet-50 border-violet-300 text-violet-800" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.milk_type === mt}
                                                    onChange={() => setEditForm(p => ({ ...p, milk_type: mt }))} className="hidden" />
                                                {mt === "cow" ? t('sellerProfile.editForm.milkTypeCow') : mt === "buffalo" ? t('sellerProfile.editForm.milkTypeBuffalo') : t('sellerProfile.editForm.milkTypeMixed')}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>
                            {/* Row 3 — Bank */}
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                                <Field label={t('sellerProfile.editForm.jamin')}>
                                    <input value={editForm.jamin}
                                        onChange={e => setEditForm(p => ({ ...p, jamin: e.target.value.replace(/[^a-zA-Z\u0900-\u097F\s]/g, "") }))}
                                        placeholder={t('sellerProfile.editForm.jaminPlaceholder')} maxLength={60}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.bankAccount')}>
                                    <input value={editForm.bank_account}
                                        onChange={e => setEditForm(p => ({ ...p, bank_account: e.target.value.replace(/\D/g, "") }))}
                                        placeholder={t('sellerProfile.editForm.bankAccountPlaceholder')} maxLength={20}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.confirmAccount')}>
                                    <input value={editForm.bank_account_confirm}
                                        onChange={e => setEditForm(p => ({ ...p, bank_account_confirm: e.target.value.replace(/\D/g, "") }))}
                                        placeholder={t('sellerProfile.editForm.confirmAccountPlaceholder')} maxLength={20}
                                        className={`border rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black transition w-full
                                            ${editForm.bank_account_confirm && editForm.bank_account !== editForm.bank_account_confirm ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus:bg-white"}`} />
                                    {editForm.bank_account_confirm && editForm.bank_account !== editForm.bank_account_confirm &&
                                        <p className="text-xs text-red-500 mt-1">{t('sellerProfile.editForm.bankMismatch')}</p>}
                                </Field>
                                <Field label={t('sellerProfile.editForm.bankName')}>
                                    <input value={editForm.bank_name}
                                        onChange={e => setEditForm(p => ({ ...p, bank_name: e.target.value.replace(/[^a-zA-Z\s.]/g, "") }))}
                                        placeholder={t('sellerProfile.editForm.bankNamePlaceholder')} maxLength={50}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.ifscCode')}>
                                    <input value={editForm.ifsc_code}
                                        onChange={e => setEditForm(p => ({ ...p, ifsc_code: e.target.value.toUpperCase() }))}
                                        placeholder={t('sellerProfile.editForm.ifscCodePlaceholder')} maxLength={11}
                                        className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                </Field>
                                <Field label={t('sellerProfile.editForm.password') || "Password"}>
                                    <div className="relative">
                                        <input
                                            type="password"
                                            value={editForm.password}
                                            onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))}
                                            placeholder={hasPassword ? "••••••• (already set — leave blank to keep)" : "Password not set yet"}
                                            maxLength={100}
                                            autoComplete="new-password"
                                            className="border border-gray-200 bg-gray-50 rounded-xl pl-8 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                        <Lock size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                    </div>
                                    <p className={`text-[10px] mt-1 ${hasPassword ? "text-emerald-600" : "text-amber-600"}`}>
                                        {hasPassword ? (t('sellerProfile.editForm.passwordSetHint') || "Password is set. Enter a new one to change it.") : (t('sellerProfile.editForm.passwordNotSetHint') || "No password set yet for this seller.")}
                                    </p>
                                </Field>
                            </div>
                            {/* Address */}
                            <Field label={t('sellerProfile.editForm.address')}>
                                <input value={editForm.address}
                                    onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                                    placeholder={t('sellerProfile.editForm.addressPlaceholder')} maxLength={200}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                <p className="text-[10px] text-gray-400 mt-0.5 text-right">{editForm.address.length}/200</p>
                            </Field>

                            {/* Advance + Deposit + Product + Cattle Feed + Payment Term + Status */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerProfile.editForm.cashAdvance')}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerProfile.editForm.enabled'), val: 1 }, { label: t('sellerProfile.editForm.disabled'), val: 0 }].map(({ label, val }) => (
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
                                    <Field label={t('sellerProfile.editForm.advanceRecovery')}>
                                        <input value={editForm.advance_deduction}
                                            onChange={e => setEditForm(p => ({ ...p, advance_deduction: e.target.value.replace(/[^0-9.]/g, "") }))}
                                            placeholder={t('sellerProfile.editForm.advanceRecoveryPlaceholder')} inputMode="decimal" maxLength={10}
                                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                    </Field>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerProfile.editForm.depositPerLitre')}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerProfile.editForm.enabled'), val: 1 }, { label: t('sellerProfile.editForm.disabled'), val: 0 }].map(({ label, val }) => (
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
                                    <Field label={t('sellerProfile.editForm.depositRate')}>
                                        <input value={editForm.deposit_per_litre}
                                            onChange={e => setEditForm(p => ({ ...p, deposit_per_litre: e.target.value.replace(/[^0-9.]/g, "") }))}
                                            placeholder={t('sellerProfile.editForm.depositRatePlaceholder')} inputMode="decimal" maxLength={6}
                                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm font-mono text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition w-full" />
                                    </Field>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerProfile.editForm.productSale')}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerProfile.editForm.enabled'), val: 1 }, { label: t('sellerProfile.editForm.disabled'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.product_sale_enabled === val ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.product_sale_enabled === val}
                                                    onChange={() => setEditForm(p => ({ ...p, product_sale_enabled: val }))} className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>

                                <Field label={t('sellerProfile.editForm.cattleFeedSale')}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerProfile.editForm.enabled'), val: 1 }, { label: t('sellerProfile.editForm.disabled'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.cattle_feed_sale_enabled === val ? val === 1 ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-red-50 border-red-300 text-red-700" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.cattle_feed_sale_enabled === val}
                                                    onChange={() => setEditForm(p => ({ ...p, cattle_feed_sale_enabled: val }))} className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </Field>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Field label={t('sellerProfile.editForm.paymentTerm')}>
                                    <div className="flex gap-2">
                                        {["postpaid", "prepaid"].map(term => (
                                            <label key={term} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.payment_term === term
                                                    ? term === "postpaid" ? "bg-blue-50 border-blue-300 text-blue-800" : "bg-amber-50 border-amber-300 text-amber-800"
                                                    : "bg-gray-50 border-gray-200 text-gray-500"}`}>
                                                <input type="radio" checked={editForm.payment_term === term}
                                                    onChange={() => setEditForm(p => ({ ...p, payment_term: term }))} className="hidden" />
                                                {term === "postpaid" ? t('sellerProfile.editForm.paymentTermPostpaid') : t('sellerProfile.editForm.paymentTermPrepaid')}
                                            </label>
                                        ))}
                                    </div>
                                </Field>

                                <Field label={t('sellerProfile.editForm.sellerStatus')}>
                                    <div className="flex gap-2">
                                        {[{ label: t('sellerProfile.editForm.active'), val: 1 }, { label: t('sellerProfile.editForm.inactive'), val: 0 }].map(({ label, val }) => (
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
                                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition">{t('sellerProfile.editForm.cancel')}</button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl text-white bg-black hover:bg-gray-800 transition disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    <Save size={13} />
                                    {saving ? t('sellerProfile.editForm.saving') : t('sellerProfile.editForm.updateSeller')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── Summary Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <StatCard
                        label={t('sellerProfile.stats.totalMilk')}
                        value={milkEntries.length ? `${totalMilk.toFixed(1)} L` : null}
                        sub={t('sellerProfile.stats.totalMilkSub', { count: milkEntries.length })}
                        color="bg-blue-50 border-blue-100"
                    />
                    <StatCard
                        label={t('sellerProfile.stats.totalEarned')}
                        value={totalEarned ? `₹${totalEarned.toFixed(2)}` : null}
                        sub={t('sellerProfile.stats.totalEarnedSub')}
                        color="bg-emerald-50 border-emerald-100"
                    />
                    <StatCard
                        label={t('sellerProfile.stats.depositBalance')}
                        value={`₹${parseFloat(depositNet || 0).toFixed(2)}`}
                        sub={t('sellerProfile.stats.depositBalanceSub')}
                        color="bg-sky-50 border-sky-100"
                    />
                    <StatCard
                        label={t('sellerProfile.stats.cashAdvance')}
                        value={totalAdvance ? `₹${totalAdvance.toFixed(2)}` : null}
                        sub={t('sellerProfile.stats.cashAdvanceSub', { amount: totalRepaid.toFixed(2) })}
                        color="bg-amber-50 border-amber-100"
                    />
                    <StatCard
                        label={t('sellerProfile.stats.productsBought')}
                        value={totalProducts ? `₹${totalProducts.toFixed(2)}` : null}
                        sub={t('sellerProfile.stats.productsBoughtSub', { count: productSales.length })}
                        color="bg-violet-50 border-violet-100"
                    />
                </div>

                {/* ── Two-column layout ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                    {/* Personal Info */}
                    <Section title={t('sellerProfile.personalInfo.title')} icon={<User size={15} />}>
                        <InfoRow icon={<Phone size={13} />} label={t('sellerProfile.personalInfo.mobile')} value={seller.mobile} mono />
                        <InfoRow icon={<CreditCard size={13} />} label={t('sellerProfile.personalInfo.aadhaar')} value={seller.aadhaar} mono />
                        <InfoRow icon={<User size={13} />} label={t('sellerProfile.personalInfo.jamin')} value={seller.jamin} />
                        <InfoRow icon={<MapPin size={13} />} label={t('sellerProfile.personalInfo.address')} value={seller.address} />
                        <InfoRow icon={<Calendar size={13} />} label={t('sellerProfile.personalInfo.registeredOn')} value={fmtDateTime(seller.created_at)} />
                        <InfoRow icon={<User size={13} />} label={t('sellerProfile.personalInfo.sellerType')} badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${sellerTypeBadge(seller.seller_type)}`}>
                                {seller.seller_type || "—"}
                            </span>
                        } />
                        <InfoRow icon={<Milk size={13} />} label={t('sellerProfile.personalInfo.milkType')} badge={
                            seller.milk_type
                                ? <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${milkBadge(seller.milk_type)}`}>
                                    {seller.milk_type}
                                </span>
                                : null
                        } />
                        <InfoRow icon={<Banknote size={13} />} label={t('sellerProfile.personalInfo.cashAdvance')} badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
                                ${seller.advance_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                                {seller.advance_enabled ? t('sellerProfile.status.enabled') : t('sellerProfile.status.disabled')}
                            </span>
                        } />
                        {seller.advance_deduction && parseFloat(seller.advance_deduction) > 0 && (
                            <InfoRow icon={<Banknote size={13} />} label={t('sellerProfile.personalInfo.advanceRecovery')}
                                value={`₹${parseFloat(seller.advance_deduction).toFixed(2)}`} mono />
                        )}
                        {Boolean(seller.deposit_enabled) && seller.deposit_per_litre && (
                            <InfoRow
                                icon={<Banknote size={13} />}
                                label={t('sellerProfile.personalInfo.depositPerLitre')}
                                value={`₹${parseFloat(seller.deposit_per_litre).toFixed(2)} / L`}
                                mono
                            />
                        )}
                        <InfoRow icon={<Star size={13} />} label={t('sellerProfile.personalInfo.status')} badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
                                ${seller.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-gray-100 text-gray-400 border-gray-200"}`}>
                                {seller.is_active ? t('sellerProfile.status.active') : t('sellerProfile.status.inactive')}
                            </span>
                        } />
                        <InfoRow icon={<ShoppingBag size={13} />} label={t('sellerProfile.personalInfo.productSale')} badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
                                ${seller.product_sale_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                                {seller.product_sale_enabled ? t('sellerProfile.status.enabled') : t('sellerProfile.status.disabled')}
                            </span>
                        } />
                        {Boolean(seller.product_sale_enabled) && seller.product_sale_rate && (
                            <InfoRow icon={<ShoppingBag size={13} />} label={t('sellerProfile.personalInfo.productSaleRate')}
                                value={`₹${parseFloat(seller.product_sale_rate).toFixed(2)} / L`} mono />
                        )}
                        <InfoRow icon={<ShoppingBag size={13} />} label={t('sellerProfile.personalInfo.cattleFeedSale')} badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
                                ${seller.cattle_feed_sale_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                                {seller.cattle_feed_sale_enabled ? t('sellerProfile.status.enabled') : t('sellerProfile.status.disabled')}
                            </span>
                        } />
                        <InfoRow icon={<CreditCard size={13} />} label={t('sellerProfile.personalInfo.paymentTerm')} badge={
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border
                                ${seller.payment_term === 'prepaid' ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                                {seller.payment_term === 'prepaid' ? t('sellerProfile.status.prepaid') : t('sellerProfile.status.postpaid')}
                            </span>
                        } />
                    </Section>

                    {/* Bank Info */}
                    <Section title={t('sellerProfile.bankDetails.title')} icon={<Landmark size={15} />}>
                        <InfoRow icon={<Hash size={13} />} label={t('sellerProfile.bankDetails.accountNumber')} value={seller.bank_account} mono />
                        <InfoRow icon={<Building2 size={13} />} label={t('sellerProfile.bankDetails.bankName')} value={seller.bank_name} />
                        <InfoRow icon={<BadgeCheck size={13} />} label={t('sellerProfile.bankDetails.ifscCode')} value={seller.ifsc_code} mono />
                    </Section>
                </div>

                {/* ── Milk Entry Chart ── */}
                {(() => {
                    const chartFiltered = applyDateFilter(milkEntries, chartFilter, chartFrom, chartTo, "entry_date");
                    const chartData = buildMilkChartData(chartFiltered);
                    const chartTotalQty = chartData.reduce((a, d) => a + d.quantity, 0);
                    const chartTotalAmt = chartData.reduce((a, d) => a + d.amount, 0);
                    return (
                        <Section title="Milk Collection Trend" icon={<BarChart3 size={15} />}>
                            <FilterBar filter={chartFilter} setFilter={setChartFilter}
                                from={chartFrom} setFrom={setChartFrom}
                                to={chartTo} setTo={setChartTo}
                                onReset={() => {}}
                                t={t} />
                            {chartData.length > 0 && (
                                <div className="flex flex-wrap gap-2 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                                        {chartData.length} day{chartData.length !== 1 ? "s" : ""} plotted
                                    </span>
                                    <span className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium">
                                        Total: {chartTotalQty.toFixed(2)} L
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        Amount: ₹{chartTotalAmt.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            {chartData.length === 0 ? (
                                <EmptyState icon={<Milk size={28} />} msg={t('sellerProfile.milkEntries.noEntries')} />
                            ) : (
                                <div className="py-4" style={{ width: "100%", height: 360 }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 24, left: 4, bottom: 10 }}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                            <XAxis
                                                dataKey="label"
                                                tick={{ fontSize: 11, fill: "#9ca3af" }}
                                                axisLine={{ stroke: "#e5e7eb" }}
                                                tickLine={false}
                                                interval={chartData.length > 20 ? Math.floor(chartData.length / 15) : 0}
                                                angle={chartData.length > 10 ? -35 : 0}
                                                textAnchor={chartData.length > 10 ? "end" : "middle"}
                                                height={chartData.length > 10 ? 55 : 30}
                                                label={{ value: "Date", position: "insideBottom", offset: -2, fontSize: 11, fill: "#9ca3af" }}
                                            />
                                            <YAxis
                                                tick={{ fontSize: 11, fill: "#9ca3af" }}
                                                axisLine={{ stroke: "#e5e7eb" }}
                                                tickLine={false}
                                                width={55}
                                                label={{ value: "Quantity (L)", angle: -90, position: "insideLeft", fontSize: 11, fill: "#9ca3af" }}
                                            />
                                            <RechartsTooltip content={<MilkChartTooltip />} cursor={{ fill: "#f8fafc" }} />
                                            <Bar dataKey="quantity" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={42} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Section>
                    );
                })()}

                {/* ── Milk Entries ── */}
                {(() => {
                    const filtered = applyDateFilter(milkEntries, milkFilter, milkFrom, milkTo, "entry_date");
                    const paginated = filtered.slice((milkPage - 1) * milkPageSize, milkPage * milkPageSize);
                    const fAvgFat = filtered.length ? (filtered.reduce((a, e) => a + parseFloat(e.fat || 0), 0) / filtered.length).toFixed(2) : null;
                    const fAvgSnf = filtered.length ? (filtered.reduce((a, e) => a + parseFloat(e.snf || 0), 0) / filtered.length).toFixed(2) : null;
                    return (
                        <Section title={t('sellerProfile.milkEntries.title')} icon={<Milk size={15} />}>
                            <FilterBar filter={milkFilter} setFilter={setMilkFilter}
                                from={milkFrom} setFrom={setMilkFrom}
                                to={milkTo} setTo={setMilkTo}
                                onReset={() => setMilkPage(1)}
                                t={t} />
                            {filtered.length > 0 && (() => {
                                const fTotalQty = filtered.reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2);
                                const fTotalAmt = filtered.reduce((a, e) => a + parseFloat(e.total_amount || 0), 0).toFixed(2);
                                const fCowQty = filtered.filter(e => (e.milk_type || "").toLowerCase() === "cow").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2);
                                const fBufQty = filtered.filter(e => (e.milk_type || "").toLowerCase() === "buffalo").reduce((a, e) => a + parseFloat(e.quantity || 0), 0).toFixed(2);
                                return (
                                    <div className="flex flex-wrap gap-2 py-3 border-b border-gray-50">
                                        <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                                            {t('sellerProfile.milkEntries.stats.avgFat', { value: fAvgFat })}
                                        </span>
                                        <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                            {t('sellerProfile.milkEntries.stats.avgSnf', { value: fAvgSnf })}
                                        </span>
                                        <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                                            {t('sellerProfile.milkEntries.stats.records', { count: filtered.length })}
                                        </span>
                                        <span className="text-xs bg-gray-50 border border-gray-200 text-gray-700 px-3 py-1 rounded-full font-medium">
                                            {t('sellerProfile.milkEntries.stats.total', { qty: fTotalQty })}
                                        </span>
                                        {parseFloat(fCowQty) > 0 && (
                                            <span className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                                                {t('sellerProfile.milkEntries.stats.cow', { qty: fCowQty })}
                                            </span>
                                        )}
                                        {parseFloat(fBufQty) > 0 && (
                                            <span className="text-xs bg-blue-50 border border-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                                                {t('sellerProfile.milkEntries.stats.buffalo', { qty: fBufQty })}
                                            </span>
                                        )}
                                        <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                            {t('sellerProfile.milkEntries.stats.amount', { amount: fTotalAmt })}
                                        </span>
                                    </div>
                                );
                            })()}
                            {filtered.length === 0 ? (
                                <EmptyState icon={<Droplet size={28} />} msg={t('sellerProfile.milkEntries.noEntries')} />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[420px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {[
                                                        t('sellerProfile.milkEntries.tableHeaders.date'),
                                                        t('sellerProfile.milkEntries.tableHeaders.shift'),
                                                        t('sellerProfile.milkEntries.tableHeaders.milk'),
                                                        t('sellerProfile.milkEntries.tableHeaders.qty'),
                                                        t('sellerProfile.milkEntries.tableHeaders.fat'),
                                                        t('sellerProfile.milkEntries.tableHeaders.snf'),
                                                        t('sellerProfile.milkEntries.tableHeaders.water'),
                                                        t('sellerProfile.milkEntries.tableHeaders.rate'),
                                                        t('sellerProfile.milkEntries.tableHeaders.amount'),
                                                        t('sellerProfile.milkEntries.tableHeaders.premium'),
                                                    ].map(h => (
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
                                                                {e.shift === "morning" ? t('sellerProfile.milkEntries.shiftMorning') : t('sellerProfile.milkEntries.shiftEvening')}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            {e.milk_type ? (
                                                                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${milkBadge(e.milk_type)}`}>
                                                                    {milkIcon(e.milk_type, milkTypeIcons)} {e.milk_type}
                                                                </span>
                                                            ) : "—"}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-700 font-medium">{e.quantity ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-blue-600">{e.fat ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-emerald-600">{e.snf ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-500">{e.water ?? "—"}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">₹{parseFloat(e.rate_applied || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(e.total_amount || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5">
                                                            {e.is_premium
                                                                ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">Premium</span>
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
                                pageSize={milkPageSize} setPageSize={setMilkPageSize} t={t} />
                        </Section>
                    );
                })()}

                {/* ── Premium Rates ── */}
                {(() => {
                    const paginated = premiumRates.slice((premPage - 1) * premPageSize, premPage * premPageSize);
                    return (
                        <Section title={t('sellerProfile.premiumRates.title')} icon={<FlaskConical size={15} />}>
                            {premiumRates.length === 0 ? (
                                <EmptyState icon={<Star size={28} />} msg={t('sellerProfile.premiumRates.noRates')} />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {[
                                                        t('sellerProfile.premiumRates.tableHeaders.milkType'),
                                                        t('sellerProfile.premiumRates.tableHeaders.rate'),
                                                        t('sellerProfile.premiumRates.tableHeaders.from'),
                                                        t('sellerProfile.premiumRates.tableHeaders.to'),
                                                        t('sellerProfile.premiumRates.tableHeaders.reason'),
                                                        t('sellerProfile.premiumRates.tableHeaders.status'),
                                                    ].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map((r) => (
                                                    <tr key={r.id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${milkBadge(r.milk_type)}`}>
                                                                {milkIcon(r.milk_type, milkTypeIcons)} {r.milk_type}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900 font-mono">₹{parseFloat(r.rate_per_liter).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(r.effective_from) || "—"}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(r.effective_to) || <span className="text-emerald-600 font-medium">{t('sellerProfile.premiumRates.active')}</span>}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 max-w-xs truncate">{r.reason || "—"}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${r.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-gray-50 text-gray-400 border border-gray-100"}`}>
                                                                {r.is_active ? t('sellerProfile.premiumRates.active') : t('sellerProfile.premiumRates.inactive')}
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
                                pageSize={premPageSize} setPageSize={setPremPageSize} t={t} />
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
                        <Section title={t('sellerProfile.cashAdvances.title')} icon={<Wallet size={15} />}>
                            <FilterBar filter={advFilter} setFilter={setAdvFilter}
                                from={advFrom} setFrom={setAdvFrom}
                                to={advTo} setTo={setAdvTo}
                                onReset={() => setAdvPage(1)}
                                t={t} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.cashAdvances.stats.given', { amount: fGiven.toFixed(2) })}
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.cashAdvances.stats.received', { amount: fReceived.toFixed(2) })}
                                    </span>
                                    <span className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.cashAdvances.stats.balance', { amount: (fGiven - fReceived).toFixed(2) })}
                                    </span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon={<Wallet size={28} />} msg={t('sellerProfile.cashAdvances.noRecords')} />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {[
                                                        t('sellerProfile.cashAdvances.tableHeaders.date'),
                                                        t('sellerProfile.cashAdvances.tableHeaders.type'),
                                                        t('sellerProfile.cashAdvances.tableHeaders.amount'),
                                                        t('sellerProfile.cashAdvances.tableHeaders.remarks'),
                                                    ].map(h => (
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
                                                                {c.type === "given" ? t('sellerProfile.cashAdvances.given') : t('sellerProfile.cashAdvances.received')}
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
                                pageSize={advPageSize} setPageSize={setAdvPageSize} t={t} />
                        </Section>
                    );
                })()}

                {/* ── Cash Deposits ── */}
                {(() => {
                    const filtered = applyDateFilter(cashDeposits, depFilter, depFrom, depTo, "transaction_date");
                    const paginated = filtered.slice((depPage - 1) * depPageSize, depPage * depPageSize);
                    const fCredit = filtered.filter(c => c.type === "credit").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
                    const fDebit = filtered.filter(c => c.type === "debit").reduce((a, c) => a + parseFloat(c.amount || 0), 0);
                    const fNet = fCredit - fDebit;
                    return (
                        <Section title={t('sellerProfile.cashDeposits.title')} icon={<Vault size={15} />}>
                            <FilterBar filter={depFilter} setFilter={setDepFilter} from={depFrom} setFrom={setDepFrom} to={depTo} setTo={setDepTo} onReset={() => setDepPage(1)} t={t} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 flex-wrap py-3 border-b border-gray-50">
                                    <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.cashDeposits.stats.records', { count: filtered.length })}
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.cashDeposits.stats.credited', { amount: fCredit.toFixed(2) })}
                                    </span>
                                    <span className="text-xs bg-rose-50 border border-rose-100 text-rose-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.cashDeposits.stats.debited', { amount: fDebit.toFixed(2) })}
                                    </span>
                                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${fNet >= 0 ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-amber-50 border-amber-100 text-amber-700"}`}>
                                        {t('sellerProfile.cashDeposits.stats.net', { amount: fNet.toFixed(2) })}
                                    </span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon={<Landmark size={28} />} msg={t('sellerProfile.cashDeposits.noRecords')} />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {[
                                                        t('sellerProfile.cashDeposits.tableHeaders.date'),
                                                        t('sellerProfile.cashDeposits.tableHeaders.type'),
                                                        t('sellerProfile.cashDeposits.tableHeaders.amount'),
                                                        t('sellerProfile.cashDeposits.tableHeaders.remarks'),
                                                    ].map(h => (
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
                                                                {c.type === "credit" ? t('sellerProfile.cashDeposits.credit') : t('sellerProfile.cashDeposits.debit')}
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
                                pageSize={depPageSize} setPageSize={setDepPageSize} t={t} />
                        </Section>
                    );
                })()}

                {/* ── Product Sales ── */}
                {(() => {
                    const filtered = applyDateFilter(productSales, prodFilter, prodFrom, prodTo, "sale_date");
                    const paginated = filtered.slice((prodPage - 1) * prodPageSize, prodPage * prodPageSize);
                    const fTotal = filtered.reduce((a, p) => a + parseFloat(p.total_amount || 0), 0);
                    return (
                        <Section title={t('sellerProfile.productsPurchased.title')} icon={<ShoppingBag size={15} />}>
                            <FilterBar filter={prodFilter} setFilter={setProdFilter}
                                from={prodFrom} setFrom={setProdFrom}
                                to={prodTo} setTo={setProdTo}
                                onReset={() => setProdPage(1)}
                                t={t} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.productsPurchased.stats.transactions', { count: filtered.length })}
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        {t('sellerProfile.productsPurchased.stats.total', { amount: fTotal.toFixed(2) })}
                                    </span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon={<Package size={28} />} msg={t('sellerProfile.productsPurchased.noRecords')} />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {[
                                                        t('sellerProfile.productsPurchased.tableHeaders.date'),
                                                        t('sellerProfile.productsPurchased.tableHeaders.product'),
                                                        t('sellerProfile.productsPurchased.tableHeaders.qty'),
                                                        t('sellerProfile.productsPurchased.tableHeaders.rate'),
                                                        t('sellerProfile.productsPurchased.tableHeaders.amount'),
                                                    ].map(h => (
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
                                pageSize={prodPageSize} setPageSize={setProdPageSize} t={t} />
                        </Section>
                    );
                })()}

                {/* ── Commission ── */}
                {seller.seller_type === 'Gavali' && commissionData && (
                    <Section title={t('sellerProfile.commission.title') || 'Commission'} icon={<Percent size={15} />}>
                        <div className="flex flex-wrap gap-2 py-3 border-b border-gray-50">
                            <span className="text-xs bg-fuchsia-50 border border-fuchsia-100 text-fuchsia-700 px-3 py-1 rounded-full font-medium">
                                Total earned: ₹{parseFloat(commissionData.total_commission_earned || 0).toFixed(2)}
                            </span>
                        </div>
                        {commissionData.settings.length === 0 ? (
                            <EmptyState icon={<Percent size={28} />} msg="No commission settings configured" />
                        ) : (
                            <div className="overflow-x-auto -mx-5">
                                <table className="w-full text-sm min-w-max">
                                    <thead>
                                        <tr className="border-b border-gray-50">
                                            {["Milk Type", "Base Fat", "Base SNF", "Base Commission", "Fat Step Cut", "SNF Step Cut", "Status"].map(h => (
                                                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {commissionData.settings.map(s => (
                                            <tr key={s.id} className="hover:bg-gray-50 transition">
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${milkBadge(s.milk_type)}`}>{s.milk_type}</span>
                                                </td>
                                                <td className="px-4 py-2.5 font-mono text-gray-600">{s.base_fat}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-600">{s.base_snf}</td>
                                                <td className="px-4 py-2.5 font-bold text-gray-900 font-mono">₹{parseFloat(s.base_commission).toFixed(2)}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-500">{s.fat_step_cut}</td>
                                                <td className="px-4 py-2.5 font-mono text-gray-500">{s.snf_step_cut}</td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.is_active ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-gray-50 text-gray-400 border border-gray-100"}`}>
                                                        {s.is_active ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>
                )}

                {/* ── Bills ── */}
                {(() => {
                    const filtered = applyDateFilter(bills, billFilter, billFrom, billTo, "paid_at");
                    const paginated = filtered.slice((billPage - 1) * billPageSize, billPage * billPageSize);
                    const fTotal = filtered.reduce((a, b) => a + parseFloat(b.final_payable || b.cash_paid || 0), 0);
                    return (
                        <Section title={t('sellerProfile.bills.title') || 'Bills'} icon={<Receipt size={15} />}>
                            <FilterBar filter={billFilter} setFilter={setBillFilter}
                                from={billFrom} setFrom={setBillFrom}
                                to={billTo} setTo={setBillTo}
                                onReset={() => setBillPage(1)} t={t} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                                        {filtered.length} bills
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        Total paid: ₹{fTotal.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon={<Receipt size={28} />} msg="No bills found" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Bill No", "Period", "Qty", "Milk Amt", "Deductions", "Final Payable", "Paid On"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map(b => {
                                                    const deductions = parseFloat(b.installment_cut || 0) + parseFloat(b.deposit_amount || 0)
                                                        + parseFloat(b.product_deduction || 0) + parseFloat(b.walkin_deduction || 0)
                                                        + parseFloat(b.cattle_feed_deduction || 0);
                                                    return (
                                                        <tr key={b.bill_id} className="hover:bg-gray-50 transition">
                                                            <td className="px-4 py-2.5 font-mono text-xs text-violet-700 font-bold">{b.bill_no}</td>
                                                            <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{fmt(b.from_date)} → {fmt(b.to_date)}</td>
                                                            <td className="px-4 py-2.5 font-mono text-gray-600">{parseFloat(b.total_qty || 0).toFixed(2)} L</td>
                                                            <td className="px-4 py-2.5 font-mono text-emerald-600">₹{parseFloat(b.milk_amount || 0).toFixed(2)}</td>
                                                            <td className="px-4 py-2.5 font-mono text-rose-500">− ₹{deductions.toFixed(2)}</td>
                                                            <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(b.final_payable || b.cash_paid || 0).toFixed(2)}</td>
                                                            <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{fmtDateTime(b.paid_at)}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={filtered.length} page={billPage} setPage={setBillPage}
                                pageSize={billPageSize} setPageSize={setBillPageSize} t={t} />
                        </Section>
                    );
                })()}

                {/* ── Bonus ── */}
                {(() => {
                    const combined = [
                        ...bonusData.bonus.map(b => ({ ...b, kind: 'Standard' })),
                        ...bonusData.gavaliBonus.map(b => ({ ...b, kind: 'Gavali' })),
                    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    const paginated = combined.slice((bonusPage - 1) * bonusPageSize, bonusPage * bonusPageSize);
                    const fTotal = combined.reduce((a, b) => a + parseFloat(b.total_bonus || 0), 0);
                    return (
                        <Section title={t('sellerProfile.bonus.title') || 'Bonus'} icon={<Gift size={15} />}>
                            {combined.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-amber-50 border border-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
                                        {combined.length} bonus records
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        Total bonus: ₹{fTotal.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            {combined.length === 0 ? (
                                <EmptyState icon={<Gift size={28} />} msg="No bonus records found" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Event", "Occasion", "Type", "Qty", "Bonus", "Status", "Paid On"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map(b => (
                                                    <tr key={`${b.kind}-${b.payment_id}`} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">{b.event_name}</td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">{b.occasion}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100">{b.kind}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">{parseFloat(b.total_qty || 0).toFixed(2)} L</td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900 font-mono">₹{parseFloat(b.total_bonus || 0).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5">
                                                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.is_paid ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-600 border border-amber-100"}`}>
                                                                {b.is_paid ? "Paid" : "Pending"}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono whitespace-nowrap">{b.paid_at ? fmtDateTime(b.paid_at) : "—"}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={combined.length} page={bonusPage} setPage={setBonusPage}
                                pageSize={bonusPageSize} setPageSize={setBonusPageSize} t={t} />
                        </Section>
                    );
                })()}

                {/* ── Cattle Feed Purchased ── */}
                {(() => {
                    const filtered = applyDateFilter(cattleFeedSales, cfFilter, cfFrom, cfTo, "sale_date");
                    const paginated = filtered.slice((cfPage - 1) * cfPageSize, cfPage * cfPageSize);
                    const fTotal = filtered.reduce((a, f) => a + parseFloat(f.total_amount || 0), 0);
                    return (
                        <Section title={t('sellerProfile.cattleFeed.title') || 'Cattle Feed Purchased'} icon={<Wheat size={15} />}>
                            <FilterBar filter={cfFilter} setFilter={setCfFilter}
                                from={cfFrom} setFrom={setCfFrom}
                                to={cfTo} setTo={setCfTo}
                                onReset={() => setCfPage(1)} t={t} />
                            {filtered.length > 0 && (
                                <div className="flex gap-3 py-3 border-b border-gray-50">
                                    <span className="text-xs bg-violet-50 border border-violet-100 text-violet-700 px-3 py-1 rounded-full font-medium">
                                        {filtered.length} transactions
                                    </span>
                                    <span className="text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-medium">
                                        Total: ₹{fTotal.toFixed(2)}
                                    </span>
                                </div>
                            )}
                            {filtered.length === 0 ? (
                                <EmptyState icon={<Wheat size={28} />} msg="No cattle feed purchases found" />
                            ) : (
                                <div className="overflow-x-auto -mx-5">
                                    <div className="max-h-[320px] overflow-y-auto">
                                        <table className="w-full text-sm min-w-max">
                                            <thead className="sticky top-0 z-10 bg-white">
                                                <tr className="border-b border-gray-50">
                                                    {["Date", "Feed", "Qty", "Rate", "Amount"].map(h => (
                                                        <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {paginated.map(f => (
                                                    <tr key={f.sale_id} className="hover:bg-gray-50 transition">
                                                        <td className="px-4 py-2.5 text-xs text-gray-500 font-mono">{fmt(f.sale_date) || "—"}</td>
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">{f.feed_name}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">{f.quantity} {f.unit || ""}</td>
                                                        <td className="px-4 py-2.5 font-mono text-gray-600">₹{parseFloat(f.rate).toFixed(2)}</td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-900">₹{parseFloat(f.total_amount).toFixed(2)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                            <Paginator total={filtered.length} page={cfPage} setPage={setCfPage}
                                pageSize={cfPageSize} setPageSize={setCfPageSize} t={t} />
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
                            <h2 className="text-gray-800 font-semibold text-base">{t('sellerProfile.deleteModal.title')}</h2>
                            <p className="text-gray-400 text-xs leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: t('sellerProfile.deleteModal.warning', { name: seller.name }) }} />
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setShowDelete(false)} disabled={deleting}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                {t('sellerProfile.deleteModal.cancel')}
                            </button>
                            <button onClick={handleDelete} disabled={deleting}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-100 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                                {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                {deleting ? t('sellerProfile.deleteModal.deleting') : t('sellerProfile.deleteModal.confirm')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}