import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import api from "../../api/axios";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
    Star, Plus, Pencil, Trash2, RefreshCw, X,
    AlertTriangle, BadgeCheck, Search, Users,
    ChevronDown, ChevronUp, Milk, Calendar,
    CheckCircle2, Clock, Ban, Filter, Home,
} from "lucide-react";

// ── SectionCard Component (matching Settings page) ────────────────────────────
function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" {...rest}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                    {icon}
                </div>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 relative z-10">{children}</div>
        </div>
    );
}

// ── helpers ───────────────────────────────────────────────────
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
    seller_id: "",
    milk_type: "cow",
    rate_per_liter: "",
    reason: "",
    effective_from: today(),
    effective_to: "",
};

// ── sub-components ────────────────────────────────────────────
function Field({ label, required, children, ...rest }) {
    return (
        <div className="flex flex-col gap-1" {...rest}>
            <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
            </label>
            {children}
        </div>
    );
}

function TinyInput({ className = "", ...props }) {
    return (
        <input
            {...props}
            className={`border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm text-gray-900
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm
                ${className}`}
        />
    );
}

function StatCard({ label, value, icon, color, t }) {
    return (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color} bg-white/60 backdrop-blur-sm shadow-sm`}>
            <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">{label}</p>
                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function StatusBadge({ rate, t }) {
    const now = today();
    const from = rate.effective_from?.split("T")[0];
    const to = rate.effective_to?.split("T")[0];

    if (!rate.is_active)
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100/80 text-gray-400 border border-gray-200/60">
                <Ban size={9} /> {t('premiumRates.inactive')}
            </span>
        );
    if (from > now)
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50/80 text-blue-600 border border-blue-200/60">
                <Clock size={9} /> {t('premiumRates.upcoming')}
            </span>
        );
    if (to && to < now)
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50/80 text-rose-500 border border-rose-200/60">
                <Ban size={9} /> {t('premiumRates.expired')}
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50/80 text-emerald-600 border border-emerald-200/60">
            <CheckCircle2 size={9} /> {t('premiumRates.active')}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function PremiumRates() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [rates, setRates] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [filterMilk, setFilterMilk] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [expanded, setExpanded] = useState({});
    const [sellerSearch, setSellerSearch] = useState("");
    const [formError, setFormError] = useState("");

    // ── confirmation modal state ──
    const [confirmModal, setConfirmModal] = useState({ open: false, id: null, action: null });
    const [processing, setProcessing] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startPremiumRatesTour = () => {
        const steps = [
            {
                element: '[data-tour="assign-btn"]',
                popover: { title: t('premiumRates.assignPremium'), description: 'Click here to assign a premium rate to a seller.' },
            },
            {
                element: '[data-tour="stats"]',
                popover: { title: t('premiumRates.totalAssigned'), description: 'See how many premium rates are assigned, active, and split by milk type.' },
            },
            {
                element: '[data-tour="filters"]',
                popover: { title: t('premiumRates.searchPlaceholder'), description: 'Search by seller name, or filter by milk type and status.' },
            },
            {
                element: '[data-tour="rates-table"]',
                popover: { title: t('premiumRates.status'), description: 'Click any row to expand and see the reason for the premium. Edit or deactivate rates here.' },
            },
        ];
        const driverObj = driver({ showProgress: true, allowClose: true, steps });
        driverObj.drive();
    };

    // ── fetch ──
    const fetchRates = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/rates/premium");
            setRates(data);
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('premiumRates.loadError'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const fetchSellers = useCallback(async () => {
        try {
            const { data } = await api.get("/sellers");
            setSellers(data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchRates();
        fetchSellers();
    }, [fetchRates, fetchSellers]);

    // ── form helpers ──
    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditId(null);
        setFormError("");
        setSellerSearch("");
        setShowForm(true);
    };

    const openEdit = (rate) => {
        setForm({
            seller_id: rate.seller_id,
            milk_type: rate.milk_type,
            rate_per_liter: rate.rate_per_liter,
            reason: rate.reason || "",
            effective_from: rate.effective_from?.split("T")[0] || today(),
            effective_to: rate.effective_to?.split("T")[0] || "",
        });
        const s = sellers.find(s => s.seller_id === rate.seller_id);
        setSellerSearch(s?.name || "");
        setEditId(rate.id);
        setFormError("");
        setShowForm(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.seller_id) { setFormError(t('premiumRates.selectSellerError')); return; }
        if (!form.rate_per_liter) { setFormError(t('premiumRates.rateRequiredError')); return; }
        if (!form.effective_from) { setFormError(t('premiumRates.fromDateRequiredError')); return; }

        setSaving(true);
        setFormError("");
        try {
            if (editId) {
                const { data } = await api.put(`/rates/premium/${editId}`, form);
                setRates(prev => prev.map(r => r.id === editId ? data : r));
                showFlash("success", t('premiumRates.updateSuccess'));
            } else {
                await api.post("/rates/premium", {
                    seller_ids: [Number(form.seller_id)],
                    milk_type: form.milk_type,
                    rate_per_liter: form.rate_per_liter,
                    reason: form.reason,
                    effective_from: form.effective_from,
                    effective_to: form.effective_to || null,
                });
                await fetchRates();
                showFlash("success", t('premiumRates.assignSuccess'));
            }
            setShowForm(false);
            setEditId(null);
        } catch (err) {
            setFormError(err.response?.data?.message || t('premiumRates.saveError'));
        } finally {
            setSaving(false);
        }
    };

    // ── deactivate & delete (now using modal) ──
    const confirmDeactivate = (id) => {
        setConfirmModal({ open: true, id, action: 'deactivate' });
    };

    const confirmDelete = (id) => {
        setConfirmModal({ open: true, id, action: 'delete' });
    };

    const handleConfirmAction = async () => {
        const { id, action } = confirmModal;
        setProcessing(true);
        try {
            if (action === 'deactivate') {
                await api.patch(`/rates/premium/${id}/deactivate`);
                setRates(prev => prev.map(r => r.id === id ? { ...r, is_active: 0 } : r));
                showFlash("success", t('premiumRates.deactivateSuccess'));
            } else if (action === 'delete') {
                await api.delete(`/rates/premium/${id}`);
                setRates(prev => prev.filter(r => r.id !== id));
                showFlash("success", t('premiumRates.deleteSuccess'));
            }
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('premiumRates.error'));
        } finally {
            setProcessing(false);
            setConfirmModal({ open: false, id: null, action: null });
        }
    };

    const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

    // ── filtered seller dropdown ──
    const filteredSellers = sellerSearch
        ? sellers.filter(s =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase()))
        : sellers;

    const selectedSeller = sellers.find(s => String(s.seller_id) === String(form.seller_id));

    // ── status helper ──
    const getStatus = (rate) => {
        const now = today();
        const from = rate.effective_from?.split("T")[0];
        const to = rate.effective_to?.split("T")[0];
        if (!rate.is_active) return "inactive";
        if (from > now) return "upcoming";
        if (to && to < now) return "expired";
        return "active";
    };

    // ── filtered list ──
    const filtered = rates.filter(r => {
        const sellerName = sellers.find(s => s.seller_id === r.seller_id)?.name || "";
        const matchSearch =
            sellerName.toLowerCase().includes(search.toLowerCase()) ||
            (r.reason || "").toLowerCase().includes(search.toLowerCase());
        const matchMilk = filterMilk === "all" ? true : r.milk_type === filterMilk;
        const matchStatus = filterStatus === "all" ? true : getStatus(r) === filterStatus;
        return matchSearch && matchMilk && matchStatus;
    });

    // ── stats ──
    const activeCount = rates.filter(r => getStatus(r) === "active").length;
    const cowCount = rates.filter(r => r.milk_type === "cow").length;
    const buffaloCount = rates.filter(r => r.milk_type === "buffalo").length;
    const uniqueSellers = [...new Set(rates.map(r => r.seller_id))].length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('premiumRates.pageTitle')}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white text-xs font-semibold shadow-md shadow-amber-500/30">
                                <Star size={12} /> Premium
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('premiumRates.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('premiumRates.pageSubtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startPremiumRatesTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('premiumRates.startTour') || 'Take a Tour'}
                        </button>
                        <button onClick={openAdd} data-tour="assign-btn"
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-200">
                            <Plus size={15} /> {t('premiumRates.assignPremium')}
                        </button>
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === 'success'
                            ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700'
                            : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-tour="stats">
                    <StatCard label={t('premiumRates.totalAssigned')} value={rates.length}
                        icon={<Star size={14} className="text-amber-600" />}
                        color="text-amber-600 bg-amber-50/80 border-amber-200/60" t={t} />
                    <StatCard label={t('premiumRates.activeNow')} value={activeCount}
                        icon={<CheckCircle2 size={14} className="text-emerald-600" />}
                        color="text-emerald-600 bg-emerald-50/80 border-emerald-200/60" t={t} />
                    <StatCard label={t('premiumRates.uniqueSellers')} value={uniqueSellers}
                        icon={<Users size={14} className="text-blue-600" />}
                        color="text-blue-600 bg-blue-50/80 border-blue-200/60" t={t} />
                    <StatCard
                        label={t('premiumRates.cowBuffalo')}
                        value={`${cowCount} / ${buffaloCount}`}
                        icon={<Milk size={14} className="text-violet-600" />}
                        color="text-violet-600 bg-violet-50/80 border-violet-200/60" t={t} />
                </div>

                {/* ── Add / Edit Form ── */}
                {showForm && (
                    <SectionCard
                        title={editId ? t('premiumRates.editPremiumRate') : t('premiumRates.assignPremiumRate')}
                        icon={<Star size={16} className="text-white" />}
                    >
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                                {/* Seller search */}
                                <Field label={t('premiumRates.seller')} required>
                                    <div className="relative">
                                        <TinyInput
                                            value={sellerSearch}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setSellerSearch(val);
                                                if (!val) { set("seller_id", ""); return; }
                                                const exact = sellers.find(s =>
                                                    s.name.toLowerCase() === val.toLowerCase() ||
                                                    (s.seller_code || "").toLowerCase() === val.toLowerCase()
                                                );
                                                if (exact) { set("seller_id", exact.seller_id); setSellerSearch(exact.name); }
                                                else set("seller_id", "");
                                            }}
                                            placeholder={t('premiumRates.searchPlaceholder')}
                                            className="w-full pr-8"
                                        />
                                        {sellerSearch && filteredSellers.length > 0 && !form.seller_id && (
                                            <div className="absolute top-full left-0 mt-1 w-full bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 overflow-hidden max-h-44 overflow-y-auto">
                                                {filteredSellers.map(s => (
                                                    <button key={s.seller_id} type="button"
                                                        onClick={() => { set("seller_id", s.seller_id); setSellerSearch(s.name); }}
                                                        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-amber-50/80 text-left transition">
                                                        <div className="w-6 h-6 rounded-full bg-amber-100/80 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
                                                            {s.name?.charAt(0)?.toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-800">{s.name}</p>
                                                            <p className="text-[10px] text-gray-400 font-mono">{s.seller_code}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        {selectedSeller && (
                                            <button type="button" onClick={() => { set("seller_id", ""); setSellerSearch(""); }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                    {selectedSeller && (
                                        <p className="text-[10px] text-emerald-600 font-medium mt-0.5">
                                            ✓ {selectedSeller.name} · {selectedSeller.seller_code}
                                        </p>
                                    )}
                                </Field>

                                {/* Milk type */}
                                <Field label={t('premiumRates.milkType')} required>
                                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                        {[
                                            { val: "cow", label: t('premiumRates.cow'), active: "bg-gradient-to-br from-amber-400 to-amber-500 text-amber-900 shadow-sm" },
                                            { val: "buffalo", label: t('premiumRates.buffalo'), active: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm" },
                                        ].map(({ val, label, active }) => (
                                            <button key={val} type="button" onClick={() => set("milk_type", val)}
                                                className={`flex-1 px-4 py-2.5 transition
                                                    ${form.milk_type === val ? active : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </Field>

                                {/* Rate */}
                                <Field label={t('premiumRates.premiumRate')} required>
                                    <TinyInput value={form.rate_per_liter}
                                        onChange={e => set("rate_per_liter", e.target.value)}
                                        type="number" step="0.01" placeholder="e.g. 42.00" />
                                </Field>

                                {/* Effective From */}
                                <Field label={t('premiumRates.effectiveFrom')} required>
                                    <TinyInput value={form.effective_from}
                                        onChange={e => set("effective_from", e.target.value)}
                                        type="date" />
                                </Field>

                                {/* Effective To */}
                                <Field label={t('premiumRates.effectiveTo')}>
                                    <TinyInput value={form.effective_to}
                                        onChange={e => set("effective_to", e.target.value)}
                                        type="date" />
                                </Field>
                            </div>

                            {/* Reason */}
                            <Field label={t('premiumRates.reasonNote')} required>
                                <textarea value={form.reason} required rows={2}
                                    onChange={e => set("reason", e.target.value)}
                                    placeholder={t('premiumRates.reasonPlaceholder')}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-900
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm resize-none" />
                            </Field>

                            {formError && (
                                <div className="flex items-center gap-2 bg-rose-50/80 border border-rose-200/60 rounded-xl px-4 py-3 text-sm text-rose-700">
                                    <AlertTriangle size={14} /> {formError}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={() => { setShowForm(false); setFormError(""); }}
                                    className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition">
                                    {t('premiumRates.cancel')}
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                                        text-white bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40 transition-all duration-200 disabled:opacity-50">
                                    {saving && <RefreshCw size={14} className="animate-spin" />}
                                    {saving ? t('premiumRates.saving') : editId ? t('premiumRates.updateRate') : t('premiumRates.assignRate')}
                                </button>
                            </div>
                        </form>
                    </SectionCard>
                )}

                {/* ── Filters ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4" data-tour="filters">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative flex-1 max-w-xs">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input value={search} onChange={e => setSearch(e.target.value)}
                                placeholder={t('premiumRates.searchPlaceholder')}
                                className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm placeholder:text-gray-300" />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Milk Type</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                {[["all", t('premiumRates.all')], ["cow", t('premiumRates.cow')], ["buffalo", t('premiumRates.buffalo')]].map(([v, l]) => (
                                    <button key={v} onClick={() => setFilterMilk(v)}
                                        className={`px-4 py-2 transition-all duration-200
                                            ${filterMilk === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                {[["all", t('premiumRates.all')], ["active", t('premiumRates.active')], ["upcoming", t('premiumRates.upcoming')], ["expired", t('premiumRates.expired')], ["inactive", t('premiumRates.inactive')]].map(([v, l]) => (
                                    <button key={v} onClick={() => setFilterStatus(v)}
                                        className={`px-3 py-2 transition-all duration-200
                                            ${filterStatus === v ? "bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-sm" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <span className="ml-auto text-xs text-gray-400">{filtered.length} {t('premiumRates.entries')}</span>
                    </div>
                </div>

                {/* ── Rates List ── */}
                <SectionCard
                    title={t('premiumRates.premiumRatesList')}
                    icon={<Star size={16} className="text-white" />}
                    data-tour="rates-table"
                >
                    <div className="overflow-x-auto">
                        {/* Table header */}
                        <div className="grid bg-gray-50/80 border-b border-gray-200/60 rounded-t-xl min-w-max"
                            style={{ gridTemplateColumns: "1.4fr 90px 90px 110px 110px 100px 110px" }}>
                            {[t('premiumRates.seller'), t('premiumRates.milk'), t('premiumRates.rateL'), t('premiumRates.from'), t('premiumRates.to'), t('premiumRates.status'), t('premiumRates.actions')].map(h => (
                                <div key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                    {h}
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-amber-500 rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                                <Star size={32} />
                                <p className="text-sm">{t('premiumRates.noRatesFound')}</p>
                            </div>
                        ) : filtered.map(rate => {
                            const seller = sellers.find(s => s.seller_id === rate.seller_id);
                            const isOpen = expanded[rate.id];
                            const status = getStatus(rate);

                            return (
                                <div key={rate.id} className="border-b border-gray-200/60 last:border-b-0">
                                    {/* Main row */}
                                    <div className="grid hover:bg-amber-50/20 transition-colors group min-w-max"
                                        style={{ gridTemplateColumns: "1.4fr 90px 90px 110px 110px 100px 110px" }}>

                                        {/* Seller */}
                                        <div className="px-4 py-3 flex items-center gap-2 cursor-pointer"
                                            onClick={() => toggleExpand(rate.id)}>
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                                                {(seller?.name || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{seller?.name || `ID:${rate.seller_id}`}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">{seller?.seller_code || "—"}</p>
                                            </div>
                                            <div className="ml-1 text-gray-300 shrink-0">
                                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </div>
                                        </div>

                                        {/* Milk type */}
                                        <div className="px-4 py-3 flex items-center">
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                                ${rate.milk_type === "cow"
                                                    ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                                                    : "bg-blue-50/80 text-blue-700 border-blue-200/60"}`}>
                                                {rate.milk_type === "cow" ? t('premiumRates.cow') : t('premiumRates.buffalo')}
                                            </span>
                                        </div>

                                        {/* Rate */}
                                        <div className="px-4 py-3 flex items-center">
                                            <span className="text-sm font-bold text-amber-600">{fmt(rate.rate_per_liter)}</span>
                                        </div>

                                        {/* From */}
                                        <div className="px-4 py-3 flex items-center">
                                            <span className="text-xs text-gray-500">{fmtDate(rate.effective_from)}</span>
                                        </div>

                                        {/* To */}
                                        <div className="px-4 py-3 flex items-center">
                                            {rate.effective_to
                                                ? <span className="text-xs text-gray-500">{fmtDate(rate.effective_to)}</span>
                                                : <span className="text-xs text-emerald-500 font-medium">{t('premiumRates.ongoing')}</span>}
                                        </div>

                                        {/* Status */}
                                        <div className="px-4 py-3 flex items-center">
                                            <StatusBadge rate={rate} t={t} />
                                        </div>

                                        {/* Actions */}
                                        <div className="px-4 py-3 flex items-center gap-1.5">
                                            {isAdmin && (
                                                <>
                                                    <button onClick={() => openEdit(rate)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 rounded-lg transition border border-blue-200/60 text-[10px] font-semibold shadow-sm">
                                                        <Pencil size={10} /> {t('premiumRates.edit')}
                                                    </button>
                                                    {rate.is_active ? (
                                                        <button onClick={() => confirmDeactivate(rate.id)}
                                                            disabled={deleting === rate.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50/80 hover:bg-amber-100/80 text-amber-600 rounded-lg transition border border-amber-200/60 text-[10px] font-semibold shadow-sm disabled:opacity-50">
                                                            <Ban size={10} /> {deleting === rate.id ? "…" : t('premiumRates.off')}
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => confirmDelete(rate.id)}
                                                            disabled={deleting === rate.id}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 rounded-lg transition border border-rose-200/60 text-[10px] font-semibold shadow-sm disabled:opacity-50">
                                                            <Trash2 size={10} /> {deleting === rate.id ? "…" : t('premiumRates.del')}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Expanded reason ── */}
                                    {isOpen && (
                                        <div className="px-5 pb-3 pt-1 border-t border-amber-200/60 bg-amber-50/30">
                                            <div className="flex items-start gap-2">
                                                <Star size={12} className="text-amber-400 mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">{t('premiumRates.reason')}</p>
                                                    <p className="text-xs text-gray-600">{rate.reason || t('premiumRates.noReason')}</p>
                                                </div>
                                            </div>
                                            {rate.created_at && (
                                                <p className="text-[10px] text-gray-400 mt-2 ml-5">
                                                    {t('premiumRates.assignedOn')} {fmtDate(rate.created_at)}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>

                {/* ── Legend ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                    <span>• <strong className="text-emerald-600">{t('premiumRates.active')}</strong> — {t('premiumRates.activeDesc')}</span>
                    <span>• <strong className="text-blue-600">{t('premiumRates.upcoming')}</strong> — {t('premiumRates.upcomingDesc')}</span>
                    <span>• <strong className="text-rose-500">{t('premiumRates.expired')}</strong> — {t('premiumRates.expiredDesc')}</span>
                    <span>• <strong className="text-gray-400">{t('premiumRates.inactive')}</strong> — {t('premiumRates.inactiveDesc')}</span>
                    {!isAdmin && <span>• {t('premiumRates.contactAdmin')}</span>}
                </div>

            </main>

            {/* ── Confirmation Modal ── */}
            {confirmModal.open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className={`w-12 h-12 rounded-full border flex items-center justify-center
                                ${confirmModal.action === 'deactivate'
                                    ? 'bg-amber-50/80 border-amber-200/60 text-amber-500'
                                    : 'bg-rose-50/80 border-rose-200/60 text-rose-500'}`}>
                                {confirmModal.action === 'deactivate'
                                    ? <Ban size={22} />
                                    : <Trash2 size={22} />}
                            </div>
                            <h2 className="text-gray-800 font-semibold text-base">
                                {confirmModal.action === 'deactivate'
                                    ? t('premiumRates.deactivateTitle', 'Deactivate Premium Rate')
                                    : t('premiumRates.deleteTitle', 'Delete Premium Rate')}
                            </h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                {confirmModal.action === 'deactivate'
                                    ? t('premiumRates.deactivateConfirm')
                                    : t('premiumRates.deleteConfirm')}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => setConfirmModal({ open: false, id: null, action: null })}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                                disabled={processing}
                            >
                                {t('premiumRates.cancel')}
                            </button>
                            <button
                                onClick={handleConfirmAction}
                                disabled={processing}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white shadow-md transition active:scale-95
                                    ${confirmModal.action === 'deactivate'
                                        ? 'bg-gradient-to-br from-amber-500 to-amber-600 shadow-amber-500/30 hover:shadow-xl hover:shadow-amber-500/40'
                                        : 'bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40'}`}
                            >
                                {processing ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                                ) : confirmModal.action === 'deactivate'
                                    ? t('premiumRates.yesDeactivate', 'Yes, Deactivate')
                                    : t('premiumRates.yesDelete', 'Yes, Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}