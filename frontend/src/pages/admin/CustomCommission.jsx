import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import api from "../../api/axios";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
    Star,
    Plus,
    Pencil,
    Trash2,
    RefreshCw,
    X,
    AlertTriangle,
    BadgeCheck,
    Search,
    Users,
    ChevronDown,
    ChevronUp,
    Milk,
    Calendar,
    CheckCircle2,
    Clock,
    Ban,
    Filter,
    DollarSign,
    Percent,
    User,
    Settings,
    Layers,
    Eye,
} from "lucide-react";

// ── SectionCard Component ──
function SectionCard({ title, icon, children, ...rest }) {
    return (
        <div className="relative rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50" {...rest}>
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60 relative z-10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center shadow-lg shadow-indigo-900/20">
                    {icon}
                </div>
                <h2 className="text-sm font-bold text-gray-800">{title}</h2>
            </div>
            <div className="p-6 relative z-10">{children}</div>
        </div>
    );
}

// ── helpers ──
const fmt = (n) => `₹${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const today = () => new Date().toISOString().split("T")[0];

const EMPTY_FORM = {
    seller_ids: [],
    milk_type: "cow",
    base_fat: "",
    base_snf: "",
    base_commission: "",
    fat_step_cut: "",
    snf_step_cut: "",
    reason: "",
    effective_from: today(),
    effective_to: "",
};

// ── sub-components ──
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
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition shadow-sm
                ${className}`}
        />
    );
}

function StatusBadge({ setting, t }) {
    const now = today();
    const from = setting.effective_from?.split("T")[0];
    const to = setting.effective_to?.split("T")[0];

    if (!setting.is_active)
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100/80 text-gray-400 border border-gray-200/60">
                <Ban size={9} /> {t('customCommission.inactive')}
            </span>
        );
    if (from > now)
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50/80 text-blue-600 border border-blue-200/60">
                <Clock size={9} /> {t('customCommission.upcoming')}
            </span>
        );
    if (to && to < now)
        return (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-rose-50/80 text-rose-500 border border-rose-200/60">
                <Ban size={9} /> {t('customCommission.expired')}
            </span>
        );
    return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50/80 text-emerald-600 border border-emerald-200/60">
            <CheckCircle2 size={9} /> {t('customCommission.active')}
        </span>
    );
}

// ── Main Page ──
export default function CustomCommission() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === "admin";

    const [settings, setSettings] = useState([]);
    const [sellers, setSellers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [editId, setEditId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState("");
    const [filterMilk, setFilterMilk] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");
    const [expanded, setExpanded] = useState({});
    const [sellerSearch, setSellerSearch] = useState("");
    const [formError, setFormError] = useState("");
    const [selectedSellers, setSelectedSellers] = useState([]);
    const [previewData, setPreviewData] = useState(null);
    const [showPreview, setShowPreview] = useState(false);

    // ── confirmation modal state ──
    const [confirmModal, setConfirmModal] = useState({ open: false, id: null, action: null });
    const [processing, setProcessing] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Tour ──
    const startTour = () => {
        const steps = [
            {
                element: '[data-tour="assign-btn"]',
                popover: {
                    title: t('customCommission.assignCustom'),
                    description: 'Assign custom commission settings to selective sellers.'
                },
            },
            {
                element: '[data-tour="stats"]',
                popover: {
                    title: t('customCommission.overview'),
                    description: 'See total assignments, active settings, and sellers covered.'
                },
            },
            {
                element: '[data-tour="filters"]',
                popover: {
                    title: t('customCommission.searchFilter'),
                    description: 'Search by seller name or filter by milk type and status.'
                },
            },
            {
                element: '[data-tour="list"]',
                popover: {
                    title: t('customCommission.assignmentsList'),
                    description: 'View and manage all custom commission assignments.'
                },
            },
        ];
        const driverObj = driver({ showProgress: true, allowClose: true, steps });
        driverObj.drive();
    };

    // ── fetch ──
    const fetchCustomSettings = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/commission/custom");
            setSettings(data);
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('customCommission.loadError'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    const fetchSellers = useCallback(async () => {
        try {
            const { data } = await api.get("/sellers?type=gavali");
            setSellers(data);
        } catch {
            /* silent */
        }
    }, []);

    useEffect(() => {
        fetchCustomSettings();
        fetchSellers();
    }, [fetchCustomSettings, fetchSellers]);

    // ── form helpers ──
    const setFormField = (k, v) => setForm(p => ({ ...p, [k]: v }));

    const openAdd = () => {
        setForm(EMPTY_FORM);
        setEditId(null);
        setFormError("");
        setSellerSearch("");
        setSelectedSellers([]);
        setShowForm(true);
        setPreviewData(null);
        setShowPreview(false);
    };

    const openEdit = (setting) => {
        setForm({
            seller_ids: [setting.seller_id],
            milk_type: setting.milk_type,
            base_fat: setting.base_fat,
            base_snf: setting.base_snf,
            base_commission: setting.base_commission || "",
            fat_step_cut: setting.fat_step_cut || "",
            snf_step_cut: setting.snf_step_cut || "",
            reason: setting.reason || "",
            effective_from: setting.effective_from?.split("T")[0] || today(),
            effective_to: setting.effective_to?.split("T")[0] || "",
        });
        const s = sellers.find(s => s.seller_id === setting.seller_id);
        setSelectedSellers(s ? [s] : []);
        setSellerSearch(s?.name || "");
        setEditId(setting.id);
        setFormError("");
        setShowForm(true);
        setPreviewData(null);
        setShowPreview(false);
    };

    const toggleSellerSelection = (seller) => {
        const exists = selectedSellers.find(s => s.seller_id === seller.seller_id);
        if (exists) {
            setSelectedSellers(prev => prev.filter(s => s.seller_id !== seller.seller_id));
            setFormField("seller_ids", form.seller_ids.filter(id => id !== seller.seller_id));
        } else {
            setSelectedSellers(prev => [...prev, seller]);
            setFormField("seller_ids", [...form.seller_ids, seller.seller_id]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.seller_ids.length) {
            setFormError(t('customCommission.selectSellerError'));
            return;
        }
        if (!form.base_fat) {
            setFormError(t('customCommission.baseFatRequired'));
            return;
        }
        if (!form.base_snf) {
            setFormError(t('customCommission.baseSnfRequired'));
            return;
        }
        if (!form.effective_from) {
            setFormError(t('customCommission.fromDateRequired'));
            return;
        }

        setSaving(true);
        setFormError("");
        try {
            const payload = {
                seller_ids: form.seller_ids,
                milk_type: form.milk_type,
                base_fat: parseFloat(form.base_fat),
                base_snf: parseFloat(form.base_snf),
                base_commission: parseFloat(form.base_commission || 0),
                fat_step_cut: parseFloat(form.fat_step_cut || 0),
                snf_step_cut: parseFloat(form.snf_step_cut || 0),
                reason: form.reason,
                effective_from: form.effective_from,
                effective_to: form.effective_to || null,
            };

            if (editId) {
                const { data } = await api.put(`/commission/custom/${editId}`, payload);
                setSettings(prev => prev.map(s => s.id === editId ? { ...data, ...payload } : s));
                showFlash("success", t('customCommission.updateSuccess'));
            } else {
                await api.post("/commission/custom", payload);
                await fetchCustomSettings();
                showFlash("success", t('customCommission.assignSuccess'));
            }
            setShowForm(false);
            setEditId(null);
        } catch (err) {
            setFormError(err.response?.data?.message || t('customCommission.saveError'));
        } finally {
            setSaving(false);
        }
    };

    // ── Preview ──
    const handlePreview = async () => {
        if (!form.seller_ids.length || !form.base_fat || !form.base_snf) {
            setFormError(t('customCommission.fillRequiredFields'));
            return;
        }

        try {
            const { data } = await api.get("/commission/custom/preview", {
                params: {
                    seller_id: form.seller_ids[0],
                    milk_type: form.milk_type,
                    fat: form.base_fat,
                    snf: form.base_snf,
                }
            });
            setPreviewData(data);
            setShowPreview(true);
        } catch (err) {
            showFlash("error", err.response?.data?.error || t('customCommission.previewError'));
        }
    };

    // ── deactivate & delete ──
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
                await api.patch(`/commission/custom/${id}/deactivate`);
                setSettings(prev => prev.map(s => s.id === id ? { ...s, is_active: 0 } : s));
                showFlash("success", t('customCommission.deactivateSuccess'));
            } else if (action === 'delete') {
                await api.delete(`/commission/custom/${id}`);
                setSettings(prev => prev.filter(s => s.id !== id));
                showFlash("success", t('customCommission.deleteSuccess'));
            }
        } catch (err) {
            showFlash("error", err.response?.data?.message || t('customCommission.error'));
        } finally {
            setProcessing(false);
            setConfirmModal({ open: false, id: null, action: null });
        }
    };

    const toggleExpand = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));

    // ── filtered sellers dropdown ──
    const filteredSellers = sellerSearch
        ? sellers.filter(s =>
            s.name.toLowerCase().includes(sellerSearch.toLowerCase()) ||
            (s.seller_code || "").toLowerCase().includes(sellerSearch.toLowerCase()))
        : sellers;

    // ── status helper ──
    const getStatus = (setting) => {
        const now = today();
        const from = setting.effective_from?.split("T")[0];
        const to = setting.effective_to?.split("T")[0];
        if (!setting.is_active) return "inactive";
        if (from > now) return "upcoming";
        if (to && to < now) return "expired";
        return "active";
    };

    // ── filtered list ──
    const filtered = settings.filter(s => {
        const sellerName = sellers.find(sl => sl.seller_id === s.seller_id)?.name || "";
        const matchSearch =
            sellerName.toLowerCase().includes(search.toLowerCase()) ||
            (s.reason || "").toLowerCase().includes(search.toLowerCase());
        const matchMilk = filterMilk === "all" ? true : s.milk_type === filterMilk;
        const matchStatus = filterStatus === "all" ? true : getStatus(s) === filterStatus;
        return matchSearch && matchMilk && matchStatus;
    });

    // ── stats ──
    const activeCount = settings.filter(s => getStatus(s) === "active").length;
    const cowCount = settings.filter(s => s.milk_type === "cow").length;
    const buffaloCount = settings.filter(s => s.milk_type === "buffalo").length;
    const uniqueSellers = [...new Set(settings.map(s => s.seller_id))].length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                            {t('customCommission.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('customCommission.pageSubtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={startTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('customCommission.startTour') || 'Take a Tour'}
                        </button>
                        <button onClick={openAdd} data-tour="assign-btn"
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200">
                            <Plus size={15} /> {t('customCommission.assignCustom')}
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
                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-indigo-600 bg-indigo-50/80 border-indigo-200/60 bg-white/60 backdrop-blur-sm shadow-sm`}>
                        <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center">
                            <Settings size={14} className="text-indigo-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">
                                {t('customCommission.totalAssignments')}
                            </p>
                            <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{settings.length}</p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-emerald-600 bg-emerald-50/80 border-emerald-200/60 bg-white/60 backdrop-blur-sm shadow-sm`}>
                        <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">
                                {t('customCommission.activeNow')}
                            </p>
                            <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{activeCount}</p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-blue-600 bg-blue-50/80 border-blue-200/60 bg-white/60 backdrop-blur-sm shadow-sm`}>
                        <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center">
                            <Users size={14} className="text-blue-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">
                                {t('customCommission.sellersCovered')}
                            </p>
                            <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{uniqueSellers}</p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-violet-600 bg-violet-50/80 border-violet-200/60 bg-white/60 backdrop-blur-sm shadow-sm`}>
                        <div className="shrink-0 w-8 h-8 rounded-xl bg-white/70 flex items-center justify-center">
                            <Milk size={14} className="text-violet-600" />
                        </div>
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60 leading-none">
                                {t('customCommission.cowBuffalo')}
                            </p>
                            <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{cowCount} / {buffaloCount}</p>
                        </div>
                    </div>
                </div>

                {/* ── Add / Edit Form ── */}
                {showForm && (
                    <SectionCard
                        title={editId ? t('customCommission.editAssignment') : t('customCommission.assignCustomCommission')}
                        icon={<Settings size={16} className="text-white" />}
                    >
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                                {/* Seller selection */}
                                <Field label={t('customCommission.selectSellers')} required>
                                    <div className="relative">
                                        <TinyInput
                                            value={sellerSearch}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setSellerSearch(val);
                                            }}
                                            placeholder={t('customCommission.searchSellers')}
                                            className="w-full pr-8"
                                        />
                                        {sellerSearch && filteredSellers.length > 0 && (
                                            <div className="absolute top-full left-0 mt-1 w-full bg-white/90 backdrop-blur-sm border border-gray-200/60 rounded-xl shadow-lg z-30 overflow-hidden max-h-44 overflow-y-auto">
                                                {filteredSellers.map(s => {
                                                    const isSelected = selectedSellers.find(sl => sl.seller_id === s.seller_id);
                                                    return (
                                                        <button
                                                            key={s.seller_id}
                                                            type="button"
                                                            onClick={() => toggleSellerSelection(s)}
                                                            className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-indigo-50/80 text-left transition ${isSelected ? 'bg-indigo-50/80' : ''}`}
                                                        >
                                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-100/80 text-indigo-700'}`}>
                                                                {s.name?.charAt(0)?.toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-medium text-gray-800">{s.name}</p>
                                                                <p className="text-[10px] text-gray-400 font-mono">{s.seller_code}</p>
                                                            </div>
                                                            {isSelected && <BadgeCheck size={12} className="text-indigo-500 ml-auto" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    {selectedSellers.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {selectedSellers.map(s => (
                                                <span key={s.seller_id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50/80 border border-indigo-200/60 rounded-lg text-[10px] font-medium text-indigo-700">
                                                    {s.name}
                                                    <button type="button" onClick={() => toggleSellerSelection(s)} className="hover:text-indigo-900">
                                                        <X size={10} />
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-[10px] text-gray-400 mt-1">{selectedSellers.length} {t('customCommission.sellersSelected')}</p>
                                </Field>

                                {/* Milk type */}
                                <Field label={t('customCommission.milkType')} required>
                                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                        {[
                                            { val: "cow", label: t('customCommission.cow'), active: "bg-gradient-to-br from-amber-400 to-amber-500 text-amber-900 shadow-sm" },
                                            { val: "buffalo", label: t('customCommission.buffalo'), active: "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm" },
                                        ].map(({ val, label, active }) => (
                                            <button key={val} type="button" onClick={() => setFormField("milk_type", val)}
                                                className={`flex-1 px-4 py-2.5 transition
                                                    ${form.milk_type === val ? active : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}>
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </Field>

                                {/* Base Fat */}
                                <Field label={t('customCommission.baseFat')} required>
                                    <TinyInput
                                        value={form.base_fat}
                                        onChange={e => setFormField("base_fat", e.target.value)}
                                        type="number" step="0.01"
                                        placeholder="e.g. 4.0"
                                        className="w-full"
                                    />
                                </Field>

                                {/* Base SNF */}
                                <Field label={t('customCommission.baseSnf')} required>
                                    <TinyInput
                                        value={form.base_snf}
                                        onChange={e => setFormField("base_snf", e.target.value)}
                                        type="number" step="0.01"
                                        placeholder="e.g. 8.5"
                                        className="w-full"
                                    />
                                </Field>

                                {/* Base Commission */}
                                <Field label={t('customCommission.baseCommission')}>
                                    <TinyInput
                                        value={form.base_commission}
                                        onChange={e => setFormField("base_commission", e.target.value)}
                                        type="number" step="0.01"
                                        placeholder="0.00"
                                        className="w-full"
                                    />
                                </Field>

                                {/* Fat Step Cut */}
                                <Field label={t('customCommission.fatStepCut')}>
                                    <TinyInput
                                        value={form.fat_step_cut}
                                        onChange={e => setFormField("fat_step_cut", e.target.value)}
                                        type="number" step="0.01"
                                        placeholder="0.00"
                                        className="w-full"
                                    />
                                    <p className="text-[10px] text-gray-400">₹ per 0.1% fat above base</p>
                                </Field>

                                {/* SNF Step Cut */}
                                <Field label={t('customCommission.snfStepCut')}>
                                    <TinyInput
                                        value={form.snf_step_cut}
                                        onChange={e => setFormField("snf_step_cut", e.target.value)}
                                        type="number" step="0.01"
                                        placeholder="0.00"
                                        className="w-full"
                                    />
                                    <p className="text-[10px] text-gray-400">₹ per 0.1% SNF above base</p>
                                </Field>

                                {/* Effective From */}
                                <Field label={t('customCommission.effectiveFrom')} required>
                                    <TinyInput
                                        value={form.effective_from}
                                        onChange={e => setFormField("effective_from", e.target.value)}
                                        type="date"
                                        className="w-full"
                                    />
                                </Field>

                                {/* Effective To */}
                                <Field label={t('customCommission.effectiveTo')}>
                                    <TinyInput
                                        value={form.effective_to}
                                        onChange={e => setFormField("effective_to", e.target.value)}
                                        type="date"
                                        className="w-full"
                                    />
                                </Field>
                            </div>

                            {/* Reason */}
                            <Field label={t('customCommission.reasonNote')}>
                                <textarea
                                    value={form.reason}
                                    rows={2}
                                    onChange={e => setFormField("reason", e.target.value)}
                                    placeholder={t('customCommission.reasonPlaceholder')}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-900
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition shadow-sm resize-none"
                                />
                            </Field>

                            {/* Preview Button */}
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handlePreview}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-indigo-50/80 border border-indigo-200/60 text-indigo-600 hover:bg-indigo-100/80 transition shadow-sm"
                                >
                                    <Eye size={14} /> {t('customCommission.preview')}
                                </button>
                            </div>

                            {/* Preview Result */}
                            {showPreview && previewData && (
                                <div className="bg-indigo-50/50 border border-indigo-200/60 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-indigo-700 mb-2">{t('customCommission.previewResult')}</p>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-gray-500">{t('customCommission.defaultCommission')}:</span>
                                            <span className="font-semibold ml-2">{fmt(previewData.default_commission)}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">{t('customCommission.customCommission')}:</span>
                                            <span className={`font-semibold ml-2 ${previewData.has_custom ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                {previewData.has_custom ? fmt(previewData.custom_commission) : '—'}
                                            </span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-gray-500">{t('customCommission.status')}:</span>
                                            <span className={`font-semibold ml-2 ${previewData.is_effective ? 'text-emerald-600' : 'text-rose-500'}`}>
                                                {previewData.is_effective ? t('customCommission.active') : t('customCommission.inactive')}
                                            </span>
                                        </div>
                                        {previewData.has_custom && (
                                            <div className="col-span-2 text-xs text-gray-400">
                                                {t('customCommission.difference')}: {fmt(previewData.custom_commission - previewData.default_commission)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {formError && (
                                <div className="flex items-center gap-2 bg-rose-50/80 border border-rose-200/60 rounded-xl px-4 py-3 text-sm text-rose-700">
                                    <AlertTriangle size={14} /> {formError}
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setShowForm(false); setFormError(""); }}
                                    className="text-sm font-medium text-gray-500 hover:text-gray-700 px-4 py-2 transition"
                                >
                                    {t('customCommission.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold
                                        text-white bg-gradient-to-br from-indigo-500 to-indigo-600 shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 disabled:opacity-50"
                                >
                                    {saving && <RefreshCw size={14} className="animate-spin" />}
                                    {saving ? t('customCommission.saving') : editId ? t('customCommission.update') : t('customCommission.assign')}
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
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={t('customCommission.searchPlaceholder')}
                                className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200/60 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white transition shadow-sm placeholder:text-gray-300"
                            />
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Milk Type</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                {[
                                    ["all", t('customCommission.all')],
                                    ["cow", t('customCommission.cow')],
                                    ["buffalo", t('customCommission.buffalo')]
                                ].map(([v, l]) => (
                                    <button
                                        key={v}
                                        onClick={() => setFilterMilk(v)}
                                        className={`px-4 py-2 transition-all duration-200
                                            ${filterMilk === v ? "bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-sm" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</span>
                            <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold bg-white/50 backdrop-blur-sm shadow-sm">
                                {[
                                    ["all", t('customCommission.all')],
                                    ["active", t('customCommission.active')],
                                    ["upcoming", t('customCommission.upcoming')],
                                    ["expired", t('customCommission.expired')],
                                    ["inactive", t('customCommission.inactive')]
                                ].map(([v, l]) => (
                                    <button
                                        key={v}
                                        onClick={() => setFilterStatus(v)}
                                        className={`px-3 py-2 transition-all duration-200
                                            ${filterStatus === v ? "bg-gradient-to-br from-indigo-600 to-indigo-800 text-white shadow-sm" : "bg-white/50 text-gray-400 hover:bg-gray-100/50"}`}
                                    >
                                        {l}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <span className="ml-auto text-xs text-gray-400">{filtered.length} {t('customCommission.entries')}</span>
                    </div>
                </div>

                {/* ── List ── */}
                <SectionCard
                    title={t('customCommission.assignmentsList')}
                    icon={<Layers size={16} className="text-white" />}
                    data-tour="list"
                >
                    <div className="overflow-x-auto">
                        {/* Table header */}
                        <div className="grid bg-gray-50/80 border-b border-gray-200/60 rounded-t-xl min-w-max"
                            style={{ gridTemplateColumns: "1.4fr 80px 70px 70px 70px 70px 80px 80px 100px" }}>
                            {[
                                t('customCommission.seller'),
                                t('customCommission.milk'),
                                t('customCommission.baseFat'),
                                t('customCommission.baseSnf'),
                                t('customCommission.baseComm'),
                                t('customCommission.fatStep'),
                                t('customCommission.snfStep'),
                                t('customCommission.status'),
                                t('customCommission.actions')
                            ].map(h => (
                                <div key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">
                                    {h}
                                </div>
                            ))}
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-6 h-6 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                                <Settings size={32} />
                                <p className="text-sm">{t('customCommission.noAssignments')}</p>
                            </div>
                        ) : filtered.map(setting => {
                            const seller = sellers.find(s => s.seller_id === setting.seller_id);
                            const isOpen = expanded[setting.id];
                            const status = getStatus(setting);

                            return (
                                <div key={setting.id} className="border-b border-gray-200/60 last:border-b-0">
                                    {/* Main row */}
                                    <div className="grid hover:bg-indigo-50/20 transition-colors group min-w-max"
                                        style={{ gridTemplateColumns: "1.4fr 80px 70px 70px 70px 70px 80px 80px 100px" }}>

                                        {/* Seller */}
                                        <div className="px-4 py-3 flex items-center gap-2 cursor-pointer"
                                            onClick={() => toggleExpand(setting.id)}>
                                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                                                {(seller?.name || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-gray-800 truncate">{seller?.name || `ID:${setting.seller_id}`}</p>
                                                <p className="text-[10px] text-gray-400 font-mono">{seller?.seller_code || "—"}</p>
                                            </div>
                                            <div className="ml-1 text-gray-300 shrink-0">
                                                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </div>
                                        </div>

                                        {/* Milk type */}
                                        <div className="px-4 py-3 flex items-center">
                                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                                ${setting.milk_type === "cow"
                                                    ? "bg-amber-50/80 text-amber-700 border-amber-200/60"
                                                    : "bg-blue-50/80 text-blue-700 border-blue-200/60"}`}>
                                                {setting.milk_type === "cow" ? t('customCommission.cow') : t('customCommission.buffalo')}
                                            </span>
                                        </div>

                                        {/* Base Fat */}
                                        <div className="px-4 py-3 flex items-center text-xs font-medium text-gray-600">
                                            {parseFloat(setting.base_fat).toFixed(1)}%
                                        </div>

                                        {/* Base SNF */}
                                        <div className="px-4 py-3 flex items-center text-xs font-medium text-gray-600">
                                            {parseFloat(setting.base_snf).toFixed(1)}%
                                        </div>

                                        {/* Base Commission */}
                                        <div className="px-4 py-3 flex items-center text-xs font-medium text-indigo-600">
                                            {fmt(setting.base_commission)}
                                        </div>

                                        {/* Fat Step Cut */}
                                        <div className="px-4 py-3 flex items-center text-xs text-gray-500">
                                            {fmt(setting.fat_step_cut || 0)}
                                        </div>

                                        {/* SNF Step Cut */}
                                        <div className="px-4 py-3 flex items-center text-xs text-gray-500">
                                            {fmt(setting.snf_step_cut || 0)}
                                        </div>

                                        {/* Status */}
                                        <div className="px-4 py-3 flex items-center">
                                            <StatusBadge setting={setting} t={t} />
                                        </div>

                                        {/* Actions */}
                                        <div className="px-4 py-3 flex items-center gap-1.5">
                                            {isAdmin && (
                                                <>
                                                    <button
                                                        onClick={() => openEdit(setting)}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 rounded-lg transition border border-blue-200/60 text-[10px] font-semibold shadow-sm"
                                                    >
                                                        <Pencil size={10} /> {t('customCommission.edit')}
                                                    </button>
                                                    {setting.is_active ? (
                                                        <button
                                                            onClick={() => confirmDeactivate(setting.id)}
                                                            disabled={processing}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50/80 hover:bg-amber-100/80 text-amber-600 rounded-lg transition border border-amber-200/60 text-[10px] font-semibold shadow-sm disabled:opacity-50"
                                                        >
                                                            <Ban size={10} /> {processing ? "…" : t('customCommission.off')}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => confirmDelete(setting.id)}
                                                            disabled={processing}
                                                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50/80 hover:bg-rose-100/80 text-rose-600 rounded-lg transition border border-rose-200/60 text-[10px] font-semibold shadow-sm disabled:opacity-50"
                                                        >
                                                            <Trash2 size={10} /> {processing ? "…" : t('customCommission.del')}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Expanded details ── */}
                                    {isOpen && (
                                        <div className="px-5 pb-3 pt-1 border-t border-indigo-200/60 bg-indigo-50/30">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                <div>
                                                    <span className="text-gray-400">{t('customCommission.effectiveFrom')}:</span>
                                                    <span className="font-medium ml-2">{fmtDate(setting.effective_from)}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">{t('customCommission.effectiveTo')}:</span>
                                                    <span className="font-medium ml-2">
                                                        {setting.effective_to ? fmtDate(setting.effective_to) : t('customCommission.ongoing')}
                                                    </span>
                                                </div>
                                                {setting.reason && (
                                                    <div className="col-span-2">
                                                        <span className="text-gray-400">{t('customCommission.reason')}:</span>
                                                        <span className="font-medium ml-2">{setting.reason}</span>
                                                    </div>
                                                )}
                                                <div className="col-span-2 text-[10px] text-gray-400 mt-1">
                                                    {t('customCommission.createdAt')}: {fmtDate(setting.created_at)}
                                                    {setting.created_by_name && ` · ${t('customCommission.by')} ${setting.created_by_name}`}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </SectionCard>

                {/* ── Info Box ── */}
                <div className="bg-indigo-50/30 border border-indigo-200/60 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100/80 flex items-center justify-center shrink-0">
                            <Info size={14} className="text-indigo-600" />
                        </div>
                        <div className="text-xs text-gray-600">
                            <p className="font-semibold text-gray-800">{t('customCommission.howItWorks')}</p>
                            <p className="mt-1">{t('customCommission.infoText')}</p>
                            <ul className="list-disc list-inside mt-2 space-y-0.5">
                                <li>{t('customCommission.info1')}</li>
                                <li>{t('customCommission.info2')}</li>
                                <li>{t('customCommission.info3')}</li>
                            </ul>
                        </div>
                    </div>
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
                                    ? t('customCommission.deactivateTitle', 'Deactivate Assignment')
                                    : t('customCommission.deleteTitle', 'Delete Assignment')}
                            </h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                {confirmModal.action === 'deactivate'
                                    ? t('customCommission.deactivateConfirm')
                                    : t('customCommission.deleteConfirm')}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => setConfirmModal({ open: false, id: null, action: null })}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                                disabled={processing}
                            >
                                {t('customCommission.cancel')}
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
                                    ? t('customCommission.yesDeactivate', 'Yes, Deactivate')
                                    : t('customCommission.yesDelete', 'Yes, Delete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}