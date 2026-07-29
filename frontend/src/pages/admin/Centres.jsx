import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Plus, X, BadgeCheck, MapPin, Phone, RefreshCw, Pencil, Trash2, AlertTriangle } from 'lucide-react';
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
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Building2 size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('centres.title')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('centres.subtitle')}
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setModalOpen(true)}
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                            bg-violet-600 text-white hover:bg-violet-700 transition">
                        <Plus size={14} /> {t('centres.newCentre')}
                    </button>
                </div>

                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border border-rose-200 text-rose-600'}`}>
                        {flash.msg}
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {loading ? (
                        <div className="col-span-full flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : centres.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Building2 size={32} />
                            <p className="text-sm">{t('centres.noCentres')}</p>
                        </div>
                    ) : centres.map(c => (
                        <div key={c.centre_id}
                            className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition
                                ${c.is_current ? 'border-violet-300 ring-2 ring-violet-100' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm font-bold text-gray-900">{c.centre_name}</p>
                                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">{c.centre_code}</p>
                                </div>
                                {c.is_current && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 border border-violet-100">
                                        <BadgeCheck size={10} /> {t('centres.current')}
                                    </span>
                                )}
                            </div>
                            {c.address && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <MapPin size={12} className="shrink-0" /> {c.address}
                                </p>
                            )}
                            {c.contact_number && (
                                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                    <Phone size={12} className="shrink-0" /> {c.contact_number}
                                </p>
                            )}
                            {!c.is_current && (
                                <button
                                    onClick={() => handleSwitch(c.centre_id)}
                                    disabled={switching === c.centre_id}
                                    className="mt-1 inline-flex items-center justify-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl
                                        bg-gray-900 text-white hover:bg-gray-800 transition disabled:opacity-50">
                                    {switching === c.centre_id
                                        ? <RefreshCw size={12} className="animate-spin" />
                                        : <RefreshCw size={12} />}
                                    {t('centres.switchButton')}
                                </button>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={() => openEditModal(c)}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl
                                        border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                    <Pencil size={12} /> Edit
                                </button>
                                <button
                                    onClick={() => openDeleteModal(c)}
                                    disabled={c.is_current || centres.length <= 1}
                                    title={c.is_current ? "Switch away from this centre before deleting it" : centres.length <= 1 ? "Cannot delete the only centre" : ""}
                                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl
                                        border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 transition disabled:opacity-40 disabled:cursor-not-allowed">
                                    <Trash2 size={12} /> Delete
                                </button>
                            </div>
                        </div>
                    ))}
                        
                </div>
            </main>

            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-sm font-bold text-gray-900">{t('centres.modal.title')}</h2>
                            <button onClick={() => setModalOpen(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.name')}</label>
                                <input required value={form.centre_name}
                                    onChange={e => setForm(p => ({ ...p, centre_name: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.code')}</label>
                                <input required value={form.centre_code}
                                    onChange={e => setForm(p => ({ ...p, centre_code: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.address')}</label>
                                <input value={form.address}
                                    onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.contact')}</label>
                                <input value={form.contact_number}
                                    onChange={e => setForm(p => ({ ...p, contact_number: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                    {t('centres.modal.cancel')}
                                </button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {saving ? t('centres.modal.creating') : t('centres.modal.create')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Centre Modal */}
            {editModalOpen && editingCentre && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Pencil size={14} className="text-violet-600" /> Edit Centre
                            </h2>
                            <button onClick={() => { setEditModalOpen(false); setEditingCentre(null); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.name')}</label>
                                <input required value={editForm.centre_name}
                                    onChange={e => setEditForm(p => ({ ...p, centre_name: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.code')}</label>
                                <input required value={editForm.centre_code}
                                    onChange={e => setEditForm(p => ({ ...p, centre_code: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.address')}</label>
                                <input value={editForm.address}
                                    onChange={e => setEditForm(p => ({ ...p, address: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('centres.modal.contact')}</label>
                                <input value={editForm.contact_number}
                                    onChange={e => setEditForm(p => ({ ...p, contact_number: e.target.value }))}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 transition" />
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" onClick={() => { setEditModalOpen(false); setEditingCentre(null); }}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                    {t('centres.modal.cancel')}
                                </button>
                                <button type="submit" disabled={updating}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50">
                                    {updating && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {updating ? "Saving…" : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Centre Modal */}
            {deleteModalOpen && deletingCentre && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                <Trash2 size={14} className="text-rose-600" /> Delete Centre
                            </h2>
                            <button onClick={() => { setDeleteModalOpen(false); setDeletingCentre(null); setDeleteConfirmText(''); }}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={15} />
                            </button>
                        </div>
                        <div className="px-6 py-5 flex flex-col gap-4">
                            <div className="flex items-start gap-3 p-3 rounded-xl bg-rose-50 border border-rose-100">
                                <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                                <div className="text-xs text-rose-700 leading-relaxed">
                                    This will <strong>permanently delete</strong> "{deletingCentre.centre_name}" and every record
                                    tied to it — sellers, operators, admins, milk entries, bills, walk-in sales, stock, bonuses,
                                    and all payment history. This cannot be undone.
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    Type <span className="font-mono text-rose-600">{deletingCentre.centre_name}</span> to confirm
                                </label>
                                <input
                                    value={deleteConfirmText}
                                    onChange={e => setDeleteConfirmText(e.target.value)}
                                    placeholder={deletingCentre.centre_name}
                                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 transition"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-1">
                                <button type="button" onClick={() => { setDeleteModalOpen(false); setDeletingCentre(null); setDeleteConfirmText(''); }}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleting || deleteConfirmText.trim() !== deletingCentre.centre_name}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition disabled:opacity-40">
                                    {deleting && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {deleting ? "Deleting…" : "Delete Permanently"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}