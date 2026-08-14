// src/pages/admin/NamedBuyersManagement.jsx
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Users, UserPlus, Search, X, Edit2, Trash2, User,
    CheckCircle2, AlertCircle, Phone, MapPin, Filter, Hash,
    Milk, MapPin as LocationIcon, Home, Settings
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

// ── Sub-components ────────────────────────────────────────────
function Field({ label, icon, children }) {
    return (
        <div className="flex flex-col gap-1 shrink-0">
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

function TableCell({ children, className = "" }) {
    return (
        <div className={`px-3 py-2.5 flex items-center border-r border-gray-100/60 last:border-r-0 text-sm ${className}`}>
            {children}
        </div>
    );
}

// ── Status Badge (localized) ──────────────────────────────────
function StatusBadge({ active }) {
    const { t } = useTranslation();
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm
            ${active
                ? "bg-emerald-50/80 text-emerald-700 border-emerald-200/60"
                : "bg-gray-100/80 text-gray-400 border-gray-200/60"}`}>
            {active ? (
                <><CheckCircle2 size={10} /> {t('namedBuyers.active')}</>
            ) : (
                <><AlertCircle size={10} /> {t('namedBuyers.inactive')}</>
            )}
        </span>
    );
}

function MilkTypeBadge({ type }) {
    const { t } = useTranslation();
    const map = {
        cow: { label: t('namedBuyers.cow'), bg: "bg-amber-50/80 text-amber-700 border-amber-200/60" },
        buffalo: { label: t('namedBuyers.buffalo'), bg: "bg-blue-50/80 text-blue-700 border-blue-200/60" },
        mixed: { label: t('namedBuyers.mixed'), bg: "bg-purple-50/80 text-purple-700 border-purple-200/60" },
    };
    const style = map[type] || map.mixed;
    return (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold border backdrop-blur-sm ${style.bg}`}>
            {style.label}
        </span>
    );
}

// ── Main Page ─────────────────────────────────────────────────
export default function NamedBuyersManagement() {
    const { t } = useTranslation();
    const { can, loading: permLoading } = usePermission();

    // ── State ───────────────────────────────────────────────────
    const [buyers, setBuyers] = useState([]);
    const [filteredBuyers, setFilteredBuyers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [showModal, setShowModal] = useState(false);
    const [editingBuyer, setEditingBuyer] = useState(null);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        mobile: "",
        address: "",
        code: "",
        default_milk_type: "mixed",
        pincode: "",
    });

    // Pagination
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // ── Fetch Data ─────────────────────────────────────────────
    const fetchBuyers = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/walkin-sales/named-buyers");
            setBuyers(data);
            setFilteredBuyers(data);
        } catch (err) {
            console.error("Failed to fetch buyers:", err);
            showFlash("error", t('namedBuyers.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBuyers();
    }, []);

    // ── Filter Buyers ──────────────────────────────────────────
    useEffect(() => {
        const filtered = buyers.filter(b =>
            b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (b.mobile && b.mobile.includes(searchTerm)) ||
            (b.address && b.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (b.code && b.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (b.pincode && b.pincode.includes(searchTerm))
        );
        setFilteredBuyers(filtered);
        setCurrentPage(1);
    }, [searchTerm, buyers]);

    // ── Flash Message ──────────────────────────────────────────
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startNamedBuyersTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="search-add"]',
                    popover: { title: t('namedBuyers.addBuyer'), description: t('namedBuyers.tourSearchAddDesc', 'Search existing buyers by name, mobile, address, or code — or register a new one.') },
                },
                {
                    element: '[data-tour="buyer-stats"]',
                    popover: { title: t('namedBuyers.total'), description: t('namedBuyers.tourStatsDesc', 'See your total buyers, and how many are active vs inactive.') },
                },
                {
                    element: '[data-tour="buyers-table"]',
                    popover: { title: t('namedBuyers.colStatus'), description: t('namedBuyers.tourTableDesc', 'Click the status badge to toggle active/inactive. Use Edit or Delete to manage a buyer.') },
                },
            ],
        });
        driverObj.drive();
    };

    // ── Form Handlers ──────────────────────────────────────────
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({
            name: "",
            mobile: "",
            address: "",
            code: "",
            default_milk_type: "mixed",
            pincode: "",
        });
        setEditingBuyer(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    const openEditModal = (buyer) => {
        setEditingBuyer(buyer);
        setFormData({
            name: buyer.name,
            mobile: buyer.mobile || "",
            address: buyer.address || "",
            code: buyer.code || "",
            default_milk_type: buyer.default_milk_type || "mixed",
            pincode: buyer.pincode || "",
        });
        setShowModal(true);
    };

    // ── CRUD Operations ────────────────────────────────────────
    const handleSave = async () => {
        if (!formData.name.trim()) {
            showFlash("error", t('namedBuyers.nameRequired'));
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: formData.name.trim(),
                mobile: formData.mobile.trim() || null,
                address: formData.address.trim() || null,
                default_milk_type: formData.default_milk_type,
                pincode: formData.pincode.trim() || null,
            };

            if (editingBuyer) {
                await api.put(`/walkin-sales/named-buyers/${editingBuyer.buyer_id}`, payload);
                showFlash("success", t('namedBuyers.updateSuccess'));
            } else {
                await api.post("/walkin-sales/named-buyers", payload);
                showFlash("success", t('namedBuyers.createSuccess'));
            }

            await fetchBuyers();
            setShowModal(false);
            resetForm();
        } catch (err) {
            const errorMsg = err.response?.data?.error || t('namedBuyers.saveError');
            showFlash("error", errorMsg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (buyer) => {
        try {
            await api.delete(`/walkin-sales/named-buyers/${buyer.buyer_id}`);
            showFlash("success", t('namedBuyers.deleteSuccess'));
            await fetchBuyers();
            setShowDeleteConfirm(null);
        } catch (err) {
            const errorMsg = err.response?.data?.error || t('namedBuyers.deleteError');
            showFlash("error", errorMsg);
        }
    };

    const toggleStatus = async (buyer) => {
        try {
            const newStatus = buyer.is_active ? 0 : 1;
            await api.patch(`/walkin-sales/named-buyers/${buyer.buyer_id}/status`, {
                is_active: newStatus
            });
            await fetchBuyers();
            showFlash("success",
                newStatus ? t('namedBuyers.activated') : t('namedBuyers.deactivated')
            );
        } catch (err) {
            showFlash("error", t('namedBuyers.statusError'));
        }
    };

    // ── Pagination ─────────────────────────────────────────────
    const totalPages = Math.ceil(filteredBuyers.length / pageSize);
    const paginatedBuyers = filteredBuyers.slice(
        (currentPage - 1) * pageSize,
        currentPage * pageSize
    );

    // ── Table Columns ──────────────────────────────────────────
    const COLS = [
        "#",
        t('namedBuyers.colCode'),
        t('namedBuyers.colName'),
        t('namedBuyers.colMobile'),
        t('namedBuyers.colAddress'),
        t('namedBuyers.colMilkType'),
        t('namedBuyers.colPincode'),
        t('namedBuyers.colStatus'),
        t('namedBuyers.colCreated'),
        t('namedBuyers.colActions')
    ];
    const GRID = "50px 80px 1.2fr 1fr 1.4fr 90px 80px 90px 110px 100px";

    // ── Render ─────────────────────────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        </div>
    );

    if (!can('named_buyers', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('namedBuyers.pageBreadcrumb', { defaultValue: 'Walk-in Sales' })}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('namedBuyers.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('namedBuyers.pageSubtitle')} — {buyers.length} {t('namedBuyers.totalBuyers')}
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap" data-tour="search-add">
                        <button
                            onClick={startNamedBuyersTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <CheckCircle2 size={15} /> {t('namedBuyers.takeTour')}
                        </button>
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('namedBuyers.searchPlaceholder')}
                                className="pl-9 pr-8 py-2.5 rounded-xl border border-gray-200/60 bg-white/50 backdrop-blur-sm text-sm text-gray-700 shadow-sm
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition w-48 sm:w-64 placeholder:text-gray-300"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {can('named_buyers', 'C') && (
                            <button
                                onClick={openCreateModal}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200"
                            >
                                <UserPlus size={16} />
                                {t('namedBuyers.addBuyer')}
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Flash Message ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === "success"
                            ? "bg-emerald-50/80 border border-emerald-200/60 text-emerald-700"
                            : "bg-rose-50/80 border border-rose-200/60 text-rose-600"}`}>
                        {flash.type === "error" && <AlertCircle size={18} />}
                        {flash.type === "success" && <CheckCircle2 size={18} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Stats Cards ── */}
                <div className="grid grid-cols-3 gap-4" data-tour="buyer-stats">
                    {[
                        {
                            label: t('namedBuyers.total'),
                            value: buyers.length,
                            icon: <Users size={16} />,
                            color: "from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700"
                        },
                        {
                            label: t('namedBuyers.active'),
                            value: buyers.filter(b => b.is_active).length,
                            icon: <CheckCircle2 size={16} />,
                            color: "from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700"
                        },
                        {
                            label: t('namedBuyers.inactive'),
                            value: buyers.filter(b => !b.is_active).length,
                            icon: <AlertCircle size={16} />,
                            color: "from-gray-50 to-gray-100/50 border-gray-200/60 text-gray-500"
                        },
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

                {/* ── Delete Confirmation Modal ── */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl w-full max-w-sm p-6 flex flex-col gap-5">
                            <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-full bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shadow-sm">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">
                                        {t('namedBuyers.confirmDelete')}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {t('namedBuyers.deleteWarning', { name: showDeleteConfirm.name })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('namedBuyers.cancel')}
                                </button>
                                <button
                                    onClick={() => handleDelete(showDeleteConfirm)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200"
                                >
                                    {t('namedBuyers.delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Create/Edit Modal ── */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-2xl w-full max-w-md p-6 flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-bold text-gray-800 flex items-center gap-2">
                                        <User size={16} className="text-gray-500" />
                                        {editingBuyer
                                            ? t('namedBuyers.editBuyer')
                                            : t('namedBuyers.addBuyer')}
                                    </h2>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        {editingBuyer
                                            ? t('namedBuyers.editDesc')
                                            : t('namedBuyers.addDesc')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                {/* Code field – read-only */}
                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        <Hash size={12} /> {t('namedBuyers.colCode')}
                                    </label>
                                    <input
                                        type="text"
                                        name="code"
                                        value={formData.code || (editingBuyer ? "" : "Auto‑generated")}
                                        disabled
                                        className="w-full border border-gray-200/60 rounded-xl px-3 py-2 text-sm text-gray-500 bg-gray-100/50 cursor-not-allowed shadow-sm"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        <User size={12} /> {t('namedBuyers.buyerName')} <span className="text-rose-500">*</span>
                                    </label>
                                    <TinyInput
                                        name="name"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        placeholder={t('namedBuyers.namePlaceholder')}
                                        className="w-full"
                                        autoFocus
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        <Phone size={12} /> {t('namedBuyers.mobile')}
                                    </label>
                                    <TinyInput
                                        name="mobile"
                                        value={formData.mobile}
                                        onChange={handleInputChange}
                                        placeholder={t('namedBuyers.mobilePlaceholder')}
                                        className="w-full"
                                        type="tel"
                                    />
                                </div>

                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        <MapPin size={12} /> {t('namedBuyers.address')}
                                    </label>
                                    <TinyInput
                                        name="address"
                                        value={formData.address}
                                        onChange={handleInputChange}
                                        placeholder={t('namedBuyers.addressPlaceholder')}
                                        className="w-full"
                                    />
                                </div>

                                {/* Default Milk Type */}
                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        <Milk size={12} /> {t('namedBuyers.defaultMilkType')}
                                    </label>
                                    <select
                                        name="default_milk_type"
                                        value={formData.default_milk_type}
                                        onChange={handleInputChange}
                                        className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                                    >
                                        <option value="mixed">{t('namedBuyers.mixed')}</option>
                                        <option value="cow">{t('namedBuyers.cow')}</option>
                                        <option value="buffalo">{t('namedBuyers.buffalo')}</option>
                                    </select>
                                </div>

                                {/* Pincode */}
                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                                        <LocationIcon size={12} /> {t('namedBuyers.pincode')}
                                    </label>
                                    <TinyInput
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={handleInputChange}
                                        placeholder={t('namedBuyers.pincodePlaceholder')}
                                        className="w-full"
                                        maxLength="10"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('namedBuyers.cancel')}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formData.name.trim()}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {saving ? t('namedBuyers.saving') : (editingBuyer ? t('namedBuyers.update') : t('namedBuyers.create'))}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Buyers Table ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden" data-tour="buyers-table">
                    {/* Table Header */}
                    <div className="grid border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wide border-r border-gray-200/60 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Table Rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : filteredBuyers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-300">
                            <Users size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">
                                {searchTerm ? t('namedBuyers.noMatches') : t('namedBuyers.noBuyers')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {paginatedBuyers.map((buyer, idx) => (
                                    <div key={buyer.buyer_id} className="grid border-b border-gray-100/60 hover:bg-blue-50/30 transition-colors" style={{ gridTemplateColumns: GRID }}>
                                        <TableCell className="text-gray-400 text-xs font-mono">
                                            {(currentPage - 1) * pageSize + idx + 1}
                                        </TableCell>
                                        <TableCell className="text-xs font-mono text-gray-500">
                                            {buyer.code || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-900 to-gray-700 text-white flex items-center justify-center text-xs font-bold shadow-sm shrink-0">
                                                    {buyer.name?.charAt(0)?.toUpperCase()}
                                                </div>
                                                <span className="text-xs font-medium text-gray-800 truncate">
                                                    {buyer.name}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-600 font-mono">
                                            {buyer.mobile || "—"}
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-500 truncate max-w-[150px]">
                                            {buyer.address || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <MilkTypeBadge type={buyer.default_milk_type || "mixed"} />
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-600 font-mono">
                                            {buyer.pincode || "—"}
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                onClick={() => toggleStatus(buyer)}
                                                disabled={!can('named_buyers', 'U')}
                                                className="hover:opacity-80 transition"
                                            >
                                                <StatusBadge active={buyer.is_active} />
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-xs text-gray-400">
                                            {buyer.created_at
                                                ? new Date(buyer.created_at).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric"
                                                })
                                                : "—"
                                            }
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {can('named_buyers', 'U') && (
                                                    <button
                                                        onClick={() => openEditModal(buyer)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50/80 border border-blue-200/60 text-gray-400 hover:text-amber-600 hover:bg-amber-100/80 transition backdrop-blur-sm shadow-sm"
                                                        title={t('namedBuyers.edit')}
                                                    >
                                                        <Edit2 size={12} />
                                                    </button>
                                                )}
                                                {can('named_buyers', 'D') && (
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(buyer)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-rose-50/80 border border-rose-200/60 text-gray-400 hover:text-rose-600 hover:bg-rose-100/80 transition backdrop-blur-sm shadow-sm"
                                                        title={t('namedBuyers.delete')}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Pagination ── */}
                {filteredBuyers.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-2xl shadow-sm">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm"
                            >
                                {t('namedBuyers.prev')}
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
                                                className={`w-7 h-7 rounded-lg text-xs font-semibold transition border
                                                    ${currentPage === p
                                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white border-gray-900 shadow-sm'
                                                        : 'bg-white/60 backdrop-blur-sm text-gray-500 border-gray-200/60 hover:border-gray-300'}`}>
                                                {p}
                                            </button>
                                    )}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-500 hover:bg-gray-50/80 disabled:opacity-40 transition shadow-sm"
                            >
                                {t('namedBuyers.next')}
                            </button>
                            <span className="text-xs text-gray-400 ml-1">
                                {filteredBuyers.length === 0 ? "0" : `${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredBuyers.length)}`} {t('namedBuyers.of')} {filteredBuyers.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{t('namedBuyers.rowsPerPage')}</span>
                            <input
                                type="number" min={1} max={filteredBuyers.length || 1}
                                value={pageSize}
                                onChange={e => { setPageSize(Math.max(1, parseInt(e.target.value) || 1)); setCurrentPage(1); }}
                                className="w-14 border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-lg px-2 py-1 text-xs text-center text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition"
                            />
                        </div>
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('namedBuyers.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('namedBuyers.footerTotal', { defaultValue: 'Total buyers' })}: <strong className="text-gray-600">{buyers.length}</strong></span>
                    <span>· {t('namedBuyers.footerActive', { defaultValue: 'Active' })}: <strong className="text-emerald-600">{buyers.filter(b => b.is_active).length}</strong></span>
                </div>

            </main>
        </div>
    );
}