import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
    Users, UserPlus, Search, X, Edit2, Trash2, User,
    CheckCircle2, AlertCircle, Phone, MapPin, Filter
} from "lucide-react";
import api from "../api/axios";
import { usePermission } from '../context/PermissionContext';
import AccessDenied from '../components/AccessDenied';

// ── Sub-components ────────────────────────────────────────────
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

// ── Status Badge ──────────────────────────────────────────────
function StatusBadge({ active }) {
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border
            ${active
                ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                : "bg-gray-100 text-gray-400 border-gray-200"}`}>
            {active ? (
                <><CheckCircle2 size={10} /> Active</>
            ) : (
                <><AlertCircle size={10} /> Inactive</>
            )}
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
        address: ""
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
            (b.address && b.address.toLowerCase().includes(searchTerm.toLowerCase()))
        );
        setFilteredBuyers(filtered);
        setCurrentPage(1);
    }, [searchTerm, buyers]);

    // ── Flash Message ──────────────────────────────────────────
    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    // ── Form Handlers ──────────────────────────────────────────
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const resetForm = () => {
        setFormData({ name: "", mobile: "", address: "" });
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
            address: buyer.address || ""
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
                address: formData.address.trim() || null
            };

            if (editingBuyer) {
                // Update existing buyer
                await api.put(`/walkin-sales/named-buyers/${editingBuyer.buyer_id}`, payload);
                showFlash("success", t('namedBuyers.updateSuccess'));
            } else {
                // Create new buyer
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
        t('namedBuyers.colName'),
        t('namedBuyers.colMobile'),
        t('namedBuyers.colAddress'),
        t('namedBuyers.colStatus'),
        t('namedBuyers.colCreated'),
        t('namedBuyers.colActions')
    ];
    const GRID = "60px 1.4fr 1fr 1.4fr 100px 120px 100px";

    // ── Render ─────────────────────────────────────────────────
    if (permLoading) return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        </div>
    );

    if (!can('named_buyers', 'R')) return <AccessDenied />;

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Users size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">
                                {t('namedBuyers.pageTitle')}
                            </h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('namedBuyers.pageSubtitle')} — {buyers.length} {t('namedBuyers.totalBuyers')}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('namedBuyers.searchPlaceholder')}
                                className="pl-9 pr-3 py-2 rounded-xl border border-gray-200 text-sm text-gray-800 bg-white 
                                    focus:outline-none focus:ring-2 focus:ring-black transition w-48 sm:w-64"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {can('named_buyers', 'C') && (
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition shadow-md"
                            >
                                <UserPlus size={15} />
                                {t('namedBuyers.addBuyer')}
                            </button>
                        )}
                    </div>
                </div>

                {/* Flash Message */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === "success"
                            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                            : "bg-rose-50 border border-rose-200 text-rose-600"}`}>
                        {flash.type === "error" && <AlertCircle size={15} />}
                        {flash.type === "success" && <CheckCircle2 size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Stats Cards */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            label: t('namedBuyers.total'),
                            value: buyers.length,
                            icon: <Users size={14} />,
                            color: "text-blue-600 bg-blue-50 border-blue-100"
                        },
                        {
                            label: t('namedBuyers.active'),
                            value: buyers.filter(b => b.is_active).length,
                            icon: <CheckCircle2 size={14} />,
                            color: "text-emerald-600 bg-emerald-50 border-emerald-100"
                        },
                        {
                            label: t('namedBuyers.inactive'),
                            value: buyers.filter(b => !b.is_active).length,
                            icon: <AlertCircle size={14} />,
                            color: "text-gray-500 bg-gray-50 border-gray-200"
                        },
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

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-sm shadow-xl p-6 flex flex-col gap-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                                    <Trash2 size={18} className="text-rose-600" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-800">
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
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                                >
                                    {t('namedBuyers.cancel')}
                                </button>
                                <button
                                    onClick={() => handleDelete(showDeleteConfirm)}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition"
                                >
                                    {t('namedBuyers.delete')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md shadow-xl p-6 flex flex-col gap-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="font-semibold text-gray-800 flex items-center gap-2">
                                        <User size={15} className="text-gray-500" />
                                        {editingBuyer
                                            ? t('namedBuyers.editBuyer')
                                            : t('namedBuyers.addBuyer')}
                                    </h2>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {editingBuyer
                                            ? t('namedBuyers.editDesc')
                                            : t('namedBuyers.addDesc')}
                                    </p>
                                </div>
                                <button
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition"
                                >
                                    <X size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <div>
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
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
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
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
                                    <label className="flex items-center gap-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
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
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setShowModal(false); resetForm(); }}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition"
                                >
                                    {t('namedBuyers.cancel')}
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving || !formData.name.trim()}
                                    className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-black hover:bg-gray-800 transition disabled:opacity-40 flex items-center justify-center gap-2"
                                >
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {saving ? t('namedBuyers.saving') : (editingBuyer ? t('namedBuyers.update') : t('namedBuyers.create'))}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Buyers Table */}
                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                    {/* Table Header */}
                    <div className="grid border-b border-gray-100 bg-gray-50/80" style={{ gridTemplateColumns: GRID }}>
                        {COLS.map((label) => (
                            <div key={label} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0">
                                {label}
                            </div>
                        ))}
                    </div>

                    {/* Table Rows */}
                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filteredBuyers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-300">
                            <Users size={32} />
                            <p className="text-sm">
                                {searchTerm ? t('namedBuyers.noMatches') : t('namedBuyers.noBuyers')}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-max">
                                {paginatedBuyers.map((buyer, idx) => (
                                    <div key={buyer.buyer_id} className="grid border-b border-gray-50 hover:bg-blue-50/20 transition-colors" style={{ gridTemplateColumns: GRID }}>
                                        <TableCell className="text-gray-400 text-xs font-mono">
                                            {(currentPage - 1) * pageSize + idx + 1}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold shrink-0">
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
                                            <div className="flex items-center gap-1">
                                                {can('named_buyers', 'U') && (
                                                    <button
                                                        onClick={() => openEditModal(buyer)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-amber-100 text-gray-400 hover:text-amber-600 transition"
                                                        title={t('namedBuyers.edit')}
                                                    >
                                                        <Edit2 size={11} />
                                                    </button>
                                                )}
                                                {can('named_buyers', 'D') && (
                                                    <button
                                                        onClick={() => setShowDeleteConfirm(buyer)}
                                                        className="w-6 h-6 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-rose-100 text-gray-400 hover:text-rose-600 transition"
                                                        title={t('namedBuyers.delete')}
                                                    >
                                                        <Trash2 size={11} />
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

                {/* Pagination */}
                {filteredBuyers.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 bg-gray-50/60 rounded-2xl">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
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
                                                    ${currentPage === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                                                {p}
                                            </button>
                                    )}
                            </div>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || totalPages === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition"
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
                                className="w-14 border border-gray-200 rounded-lg px-2 py-1 text-xs text-center text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-black transition"
                            />
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}