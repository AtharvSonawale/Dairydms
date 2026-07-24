// pages/admin/AdminList.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Users, Plus, Search, X, BadgeCheck, AlertTriangle,
    Mail, Phone, Power, ChevronRight, Building2,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

function CreateAdminModal({ open, onClose, onCreated, showFlash, t }) {
    const [form, setForm] = useState({ name: '', email: '', password: '', mobile: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    if (!open) return null;

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            const { data } = await api.post('/admin-management', form);
            onCreated(data);
            showFlash('success', t('adminList.createSuccess', { name: data.name }));
            setForm({ name: '', email: '', password: '', mobile: '' });
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || t('adminList.createError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
                            <Plus size={16} className="text-white" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">{t('adminList.modal.title')}</h2>
                    </div>
                    <button onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
                            <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                            <p className="text-xs text-rose-700">{error}</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">{t('adminList.modal.fullName')}</label>
                        <input name="name" value={form.name} onChange={handleChange} required
                            placeholder={t('adminList.modal.namePlaceholder')}
                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">{t('adminList.modal.email')}</label>
                        <input name="email" type="email" value={form.email} onChange={handleChange} required
                            placeholder={t('adminList.modal.emailPlaceholder')}
                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">
                            {t('adminList.modal.mobile')} <span className="text-gray-400 font-normal">{t('adminList.modal.optional')}</span>
                        </label>
                        <input name="mobile" type="tel" value={form.mobile} onChange={handleChange}
                            placeholder={t('adminList.modal.mobilePlaceholder')} pattern="^\+?[0-9]{10,15}$"
                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium text-gray-700">{t('adminList.modal.password')}</label>
                        <input name="password" type="password" value={form.password} onChange={handleChange} required
                            placeholder={t('adminList.modal.passwordPlaceholder')}
                            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                            {t('adminList.modal.cancel')}
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
                            {saving
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <BadgeCheck size={12} />}
                            {saving ? t('adminList.modal.creating') : t('adminList.modal.create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function AdminList() {
    const { t } = useTranslation();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [flash, setFlash] = useState(null);
    const [togglingId, setTogglingId] = useState(null);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const startAdminListTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="add-admin-btn"]',
                    popover: {
                        title: t('adminList.tour.addAdmin.title'),
                        description: t('adminList.tour.addAdmin.description'),
                    },
                },
                {
                    element: '[data-tour="search-filter"]',
                    popover: {
                        title: t('adminList.tour.searchFilter.title'),
                        description: t('adminList.tour.searchFilter.description'),
                    },
                },
                {
                    element: '[data-tour="admin-list"]',
                    popover: {
                        title: t('adminList.tour.adminList.title'),
                        description: t('adminList.tour.adminList.description'),
                    },
                },
            ],
        });
        driverObj.drive();
    };

    const fetchAdmins = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/admin-management');
            setAdmins(data);
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('adminList.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAdmins(); }, []);

    const handleToggleStatus = async (e, admin) => {
        e.stopPropagation();
        if (togglingId) return;
        setTogglingId(admin.admin_id);
        try {
            await api.patch(`/admin-management/${admin.admin_id}/status`, {
                is_active: admin.is_active ? 0 : 1,
            });
            showFlash('success', admin.is_active ? t('adminList.deactivated', { name: admin.name }) : t('adminList.reactivated', { name: admin.name }));
            await fetchAdmins();
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('adminList.statusError'));
        } finally {
            setTogglingId(null);
        }
    };

    const filtered = admins.filter(a => {
        const matchSearch =
            a.name.toLowerCase().includes(search.toLowerCase()) ||
            a.email.toLowerCase().includes(search.toLowerCase());
        const matchStatus =
            filterStatus === 'all' ? true :
                filterStatus === 'active' ? !!a.is_active : !a.is_active;
        return matchSearch && matchStatus;
    });

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
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('adminList.title')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('adminList.subtitle')}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button onClick={startAdminListTour}
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                            <BadgeCheck size={13} /> {t('adminList.takeTour')}
                        </button>
                        <button onClick={() => setCreateOpen(true)} data-tour="add-admin-btn"
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl
                                bg-blue-600 text-white hover:bg-blue-700 transition">
                            <Plus size={14} /> {t('adminList.addAdmin')}
                        </button>
                    </div>
                </div>

                {/* Flash */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border border-rose-200 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* Search + Filter */}
                <div className="flex items-center gap-2" data-tour="search-filter">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('adminList.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-xs font-semibold">
                        {[
                            ['all', t('adminList.filterAll')],
                            ['active', t('adminList.filterActive')],
                            ['inactive', t('adminList.filterInactive')]
                        ].map(([v, l]) => (
                            <button key={v} onClick={() => setFilterStatus(v)}
                                className={`px-3 py-2 transition
                                    ${filterStatus === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-400 hover:bg-gray-50'}`}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>

                {/* List */}
                <div className="flex flex-col gap-2" data-tour="admin-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                            <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                            <Users size={32} />
                            <p className="text-sm">{t('adminList.noAdmins')}</p>
                        </div>
                    ) : filtered.map(admin => (
                        <div key={admin.admin_id}
                            onClick={() => navigate(`/admin/admins/${admin.admin_id}`)}
                            className={`bg-white rounded-2xl border px-5 py-4 flex items-center gap-4 cursor-pointer
                                hover:border-gray-300 transition
                                ${admin.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>

                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                ${admin.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                                {admin.name.charAt(0).toUpperCase()}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{admin.name}</p>
                                    {admin.admin_id === user?.id && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                            {t('adminList.youBadge')}
                                        </span>
                                    )}
                                    {!admin.is_active && (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                            {t('status.inactive')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                        <Mail size={10} /> {admin.email}
                                    </span>
                                    {admin.mobile && (
                                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                            <Phone size={10} /> {admin.mobile}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400">
                                <Building2 size={11} /> {admin.centre_name}
                            </div>

                            {admin.admin_id !== user?.id && (
                                <button
                                    onClick={(e) => handleToggleStatus(e, admin)}
                                    disabled={togglingId === admin.admin_id}
                                    title={admin.is_active ? t('adminList.deactivateTitle') : t('adminList.reactivateTitle')}
                                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition disabled:opacity-50
                                        ${admin.is_active
                                            ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                                    <Power size={11} />
                                    {admin.is_active ? t('adminList.deactivateButton') : t('adminList.reactivateButton')}
                                </button>
                            )}

                            <ChevronRight size={16} className="text-gray-300 shrink-0" />
                        </div>
                    ))}
                </div>
            </main>

            <CreateAdminModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreated={() => fetchAdmins()}
                showFlash={showFlash}
                t={t}
            />
        </div>
    );
}