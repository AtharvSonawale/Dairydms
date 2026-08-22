import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, X, BadgeCheck, MapPin, Phone, RefreshCw, Pencil, Trash2, AlertTriangle, Home, Settings } from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function Centres() {
    const { t } = useTranslation();
    const { user, login } = useAuth();

    const [centres, setCentres] = useState([]);
    const [loading, setLoading] = useState(true);
    const [flash, setFlash] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [switching, setSwitching] = useState(null);
    const [form, setForm] = useState({ centre_name: '', centre_code: '', address: '', contact_number: '' });

    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingCentre, setEditingCentre] = useState(null);
    const [editForm, setEditForm] = useState({ centre_name: '', centre_code: '', address: '', contact_number: '' });
    const [updating, setUpdating] = useState(false);

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deletingCentre, setDeletingCentre] = useState(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchCentres = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/centres');
            setCentres(data);
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('centres.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCentres(); }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/centres', form);
            showFlash('success', t('centres.createSuccess'));
            setModalOpen(false);
            setForm({ centre_name: '', centre_code: '', address: '', contact_number: '' });
            fetchCentres();
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('centres.createError'));
        } finally {
            setSaving(false);
        }
    };

    const handleSwitch = async (centre_id) => {
        setSwitching(centre_id);
        try {
            const { data } = await api.post('/centres/switch', { centre_id });
            login(data);
            showFlash('success', t('centres.switchSuccess', { name: data.centre_name }));
            setTimeout(() => window.location.reload(), 600);
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('centres.switchError'));
            setSwitching(null);
        }
    };

    const openEditModal = (centre) => {
        setEditingCentre(centre);
        setEditForm({
            centre_name: centre.centre_name,
            centre_code: centre.centre_code,
            address: centre.address || '',
            contact_number: centre.contact_number || '',
        });
        setEditModalOpen(true);
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingCentre) return;
        setUpdating(true);
        try {
            await api.put(`/centres/${editingCentre.centre_id}`, editForm);
            showFlash('success', 'Centre updated successfully.');
            setEditModalOpen(false);
            setEditingCentre(null);
            fetchCentres();
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to update centre.');
        } finally {
            setUpdating(false);
        }
    };

    const openDeleteModal = (centre) => {
        setDeletingCentre(centre);
        setDeleteConfirmText('');
        setDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingCentre) return;
        if (deleteConfirmText.trim() !== deletingCentre.centre_name) {
            showFlash('error', 'Typed name does not match. Deletion cancelled.');
            return;
        }
        setDeleting(true);
        try {
            await api.delete(`/centres/${deletingCentre.centre_id}`);
            showFlash('success', `Centre "${deletingCentre.centre_name}" deleted.`);
            setDeleteModalOpen(false);
            setDeletingCentre(null);
            setDeleteConfirmText('');
            fetchCentres();
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to delete centre.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('centres.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('centres.subtitle')}
                        </p>
                    </div>

                    <button
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200"
                    >
                        <Plus size={16} /> {t('centres.newCentre')}
                    </button>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === 'success'
                            ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700'
                            : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        {flash.msg}
                        <button
                            onClick={() => setFlash(null)}
                            className="ml-auto opacity-50 hover:opacity-100 transition"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Centre Cards ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {loading ? (
                        <div className="col-span-full flex items-center justify-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : centres.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 gap-3 text-gray-300">
                            <Building2 size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">{t('centres.noCentres')}</p>
                            <button
                                onClick={() => setModalOpen(true)}
                                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl transition-all"
                            >
                                <Plus size={14} /> {t('centres.newCentre')}
                            </button>
                        </div>
                    ) : centres.map(c => (
                        <div
                            key={c.centre_id}
                            className={`relative overflow-hidden rounded-2xl border p-5 flex flex-col gap-3 transition-all duration-200
                                ${c.is_current
                                    ? 'bg-gradient-to-br from-violet-50 to-violet-100/50 border-violet-200/60 shadow-lg shadow-violet-200/30'
                                    : 'bg-white/80 backdrop-blur-sm border-gray-200/60 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-200/60'}`}
                        >
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-violet-400/5 blur-3xl" />

                            <div className="flex items-start justify-between relative z-10">
                                <div>
                                    <p className="text-base font-bold text-gray-900">{c.centre_name}</p>
                                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">{c.centre_code}</p>
                                </div>
                                {c.is_current && (
                                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/30">
                                        <BadgeCheck size={10} /> {t('centres.current')}
                                    </span>
                                )}
                            </div>

                            {c.address && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 relative z-10">
                                    <MapPin size={14} className="shrink-0 text-gray-400" /> {c.address}
                                </p>
                            )}
                            {c.contact_number && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5 relative z-10">
                                    <Phone size={14} className="shrink-0 text-gray-400" /> {c.contact_number}
                                </p>
                            )}

                            <div className="flex items-center gap-2 mt-1 relative z-10">
                                {!c.is_current ? (
                                    <button
                                        onClick={() => handleSwitch(c.centre_id)}
                                        disabled={switching === c.centre_id}
                                        className="flex-1 inline-flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl
                                            bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                                    >
                                        {switching === c.centre_id
                                            ? <RefreshCw size={14} className="animate-spin" />
                                            : <RefreshCw size={14} />}
                                        {t('centres.switchButton')}
                                    </button>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-xl
                                        bg-emerald-50/80 border border-emerald-200/60 text-emerald-700 backdrop-blur-sm">
                                        <BadgeCheck size={14} /> {t('centres.currentActive')}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-2 relative z-10">
                                <button
                                    onClick={() => openEditModal(c)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl
                                        border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 hover:border-gray-300 transition-all duration-200 shadow-sm"
                                >
                                    <Pencil size={13} /> {t('centres.edit')}
                                </button>
                                <button
                                    onClick={() => openDeleteModal(c)}
                                    disabled={c.is_current || centres.length <= 1}
                                    title={c.is_current ? "Switch away from this centre before deleting it" : centres.length <= 1 ? "Cannot delete the only centre" : ""}
                                    className={`flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2.5 rounded-xl
                                        transition-all duration-200 shadow-sm
                                        ${!c.is_current && centres.length > 1
                                            ? 'border border-rose-200/60 bg-rose-50/80 backdrop-blur-sm text-rose-600 hover:bg-rose-100/80 hover:border-rose-300'
                                            : 'border border-gray-200/60 bg-gray-50/60 backdrop-blur-sm text-gray-400 cursor-not-allowed opacity-60'}`}
                                >
                                    <Trash2 size={13} /> {t('centres.delete')}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('centres.footerTotal', { defaultValue: 'Total centres' })}: <strong className="text-gray-600">{centres.length}</strong></span>
                    <span>· {t('centres.footerActive', { defaultValue: 'Active centre' })}: <strong className="text-emerald-600">{centres.find(c => c.is_current)?.centre_name || '—'}</strong></span>
                    <span>· {t('centres.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                </div>
            </main>

            {/* ── Create Centre Modal ── */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50">
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Building2 size={16} className="text-violet-600" /> {t('centres.modal.title')}
                            </h2>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.name')}</label>
                                <input
                                    required
                                    value={form.centre_name}
                                    onChange={e => setForm(p => ({ ...p, centre_name: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.code')}</label>
                                <input
                                    required
                                    value={form.centre_code}
                                    onChange={e => setForm(p => ({ ...p, centre_code: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.address')}</label>
                                <input
                                    value={form.address}
                                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.contact')}</label>
                                <input
                                    value={form.contact_number}
                                    onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100/60">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('centres.modal.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-50"
                                >
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {saving ? t('centres.modal.creating') : t('centres.modal.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit Centre Modal ── */}
            {editModalOpen && editingCentre && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50">
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Pencil size={16} className="text-violet-600" /> {t('centres.modal.editTitle', { defaultValue: 'Edit Centre' })}
                            </h2>
                            <button
                                onClick={() => { setEditModalOpen(false); setEditingCentre(null); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.name')}</label>
                                <input
                                    required
                                    value={editForm.centre_name}
                                    onChange={e => setEditForm(p => ({ ...p, centre_name: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.code')}</label>
                                <input
                                    required
                                    value={editForm.centre_code}
                                    onChange={e => setEditForm(p => ({ ...p, centre_code: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.address')}</label>
                                <input
                                    value={editForm.address}
                                    onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{t('centres.modal.contact')}</label>
                                <input
                                    value={editForm.contact_number}
                                    onChange={e => setEditForm(p => ({ ...p, contact_number: e.target.value }))}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-violet-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100/60">
                                <button
                                    type="button"
                                    onClick={() => { setEditModalOpen(false); setEditingCentre(null); }}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('centres.modal.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={updating}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/30 hover:shadow-xl hover:shadow-violet-500/40 transition-all duration-200 disabled:opacity-50"
                                >
                                    {updating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {updating ? t('centres.modal.saving') : t('centres.modal.saveChanges')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Delete Centre Modal ── */}
            {deleteModalOpen && deletingCentre && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-rose-50/50 to-white/50">
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Trash2 size={16} className="text-rose-600" /> {t('centres.deleteModal.title', { defaultValue: 'Delete Centre' })}
                            </h2>
                            <button
                                onClick={() => { setDeleteModalOpen(false); setDeletingCentre(null); setDeleteConfirmText(''); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 shadow-sm">
                                <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-rose-700 leading-relaxed">
                                    {t('centres.deleteModal.warning', {
                                        defaultValue: 'This will <strong>permanently delete</strong> "{name}" and every record tied to it — sellers, operators, admins, milk entries, bills, walk-in sales, stock, bonuses, and all payment history. This cannot be undone.',
                                        name: deletingCentre.centre_name
                                    })}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('centres.deleteModal.confirmLabel', {
                                        defaultValue: 'Type <span class="font-mono text-rose-600">{name}</span> to confirm',
                                        name: deletingCentre.centre_name
                                    })}
                                </label>
                                <input
                                    value={deleteConfirmText}
                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                    placeholder={deletingCentre.centre_name}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                        focus:outline-none focus:ring-2 focus:ring-rose-300/50 focus:bg-white transition shadow-sm"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1 border-t border-gray-100/60">
                                <button
                                    type="button"
                                    onClick={() => { setDeleteModalOpen(false); setDeletingCentre(null); setDeleteConfirmText(''); }}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                                >
                                    {t('centres.deleteModal.cancel')}
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting || deleteConfirmText.trim() !== deletingCentre.centre_name}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 disabled:opacity-40"
                                >
                                    {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {deleting ? t('centres.deleteModal.deleting') : t('centres.deleteModal.deletePermanently')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}