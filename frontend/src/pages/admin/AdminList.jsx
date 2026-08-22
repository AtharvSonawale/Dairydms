// pages/admin/AdminList.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Users, Plus, Search, X, BadgeCheck, AlertTriangle,
    Mail, Phone, Power, ChevronRight, Building2,
    Home, Settings,
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
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                            <Plus size={16} className="text-white" />
                        </div>
                        <h2 className="text-sm font-bold text-gray-900">{t('adminList.modal.title')}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                    >
                        <X size={16} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
                    {error && (
                        <div className="flex items-center gap-2 bg-rose-50/80 backdrop-blur-sm border border-rose-200/60 rounded-xl px-4 py-3 shadow-sm">
                            <AlertTriangle size={14} className="text-rose-400 shrink-0" />
                            <p className="text-xs text-rose-700">{error}</p>
                        </div>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('adminList.modal.fullName')}</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            required
                            placeholder={t('adminList.modal.namePlaceholder')}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('adminList.modal.email')}</label>
                        <input
                            name="email"
                            type="email"
                            value={form.email}
                            onChange={handleChange}
                            required
                            placeholder={t('adminList.modal.emailPlaceholder')}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            {t('adminList.modal.mobile')} <span className="font-normal normal-case text-gray-400">{t('adminList.modal.optional')}</span>
                        </label>
                        <input
                            name="mobile"
                            type="tel"
                            value={form.mobile}
                            onChange={handleChange}
                            placeholder={t('adminList.modal.mobilePlaceholder')}
                            pattern="^\+?[0-9]{10,15}$"
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('adminList.modal.password')}</label>
                        <input
                            name="password"
                            type="password"
                            value={form.password}
                            onChange={handleChange}
                            required
                            placeholder={t('adminList.modal.passwordPlaceholder')}
                            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:bg-white transition"
                        />
                    </div>

                    <div className="flex justify-end gap-2 mt-2 border-t border-gray-100/60 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            {t('adminList.modal.cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50"
                        >
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

    const activeCount = admins.filter(a => a.is_active).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('adminList.title')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('adminList.subtitle')}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            onClick={startAdminListTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('adminList.takeTour')}
                        </button>
                        <button
                            onClick={() => setCreateOpen(true)}
                            data-tour="add-admin-btn"
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200"
                        >
                            <Plus size={16} /> {t('adminList.addAdmin')}
                        </button>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                        { label: t('adminList.totalAdmins'), value: admins.length, color: 'from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700', icon: <Users size={16} /> },
                        { label: t('adminList.active'), value: activeCount, color: 'from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700', icon: <BadgeCheck size={16} /> },
                        { label: t('adminList.inactive'), value: admins.length - activeCount, color: 'from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600', icon: <X size={16} /> },
                    ].map(({ label, value, color, icon }) => (
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

                {/* ── Search + Filter ── */}
                <div className="flex items-center gap-2" data-tour="search-filter">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('adminList.searchPlaceholder')}
                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl text-gray-700 shadow-sm
                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition placeholder:text-gray-300"
                        />
                    </div>
                    <div className="flex rounded-xl border border-gray-200/60 overflow-hidden text-xs font-semibold shadow-sm bg-white/60 backdrop-blur-sm">
                        {[
                            ['all', t('adminList.filterAll')],
                            ['active', t('adminList.filterActive')],
                            ['inactive', t('adminList.filterInactive')]
                        ].map(([v, l]) => (
                            <button
                                key={v}
                                onClick={() => setFilterStatus(v)}
                                className={`px-3.5 py-2 transition-all duration-200
                                    ${filterStatus === v
                                        ? 'bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30'
                                        : 'text-gray-500 hover:bg-gray-100/50'}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>
                    <span className="ml-auto text-xs text-gray-400">
                        {filtered.length} {filtered.length === 1 ? t('adminList.admin') : t('adminList.admins')}
                    </span>
                </div>

                {/* ── Admin List ── */}
                <div className="flex flex-col gap-3" data-tour="admin-list">
                    {loading ? (
                        <div className="flex items-center justify-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50">
                            <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 gap-3 text-gray-300">
                            <Users size={40} className="text-gray-200" />
                            <p className="text-sm font-medium">{t('adminList.noAdmins')}</p>
                            <button
                                onClick={() => setCreateOpen(true)}
                                className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-xl transition-all"
                            >
                                <Plus size={14} /> {t('adminList.addAdmin')}
                            </button>
                        </div>
                    ) : filtered.map(admin => (
                        <div
                            key={admin.admin_id}
                            onClick={() => navigate(`/admin/admins/${admin.admin_id}`)}
                            className={`relative overflow-hidden rounded-2xl border px-5 py-4 flex items-center gap-4 cursor-pointer transition-all duration-200 group
                                ${admin.is_active
                                    ? 'bg-white/80 backdrop-blur-sm border-gray-200/60 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-200/60'
                                    : 'bg-white/50 backdrop-blur-sm border-gray-200/40 shadow-sm opacity-70 hover:shadow-md'}`}
                        >
                            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />

                            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 relative z-10
                                ${admin.is_active
                                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                                    : 'bg-gradient-to-br from-gray-400 to-gray-500 text-white'}`}>
                                {admin.name.charAt(0).toUpperCase()}
                            </div>

                            <div className="flex-1 min-w-0 relative z-10">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-bold text-gray-800 truncate">{admin.name}</p>
                                    {admin.admin_id === user?.id && (
                                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-50/80 text-blue-600 border border-blue-200/60 backdrop-blur-sm">
                                            {t('adminList.youBadge')}
                                        </span>
                                    )}
                                    {!admin.is_active && (
                                        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-gray-100/80 text-gray-500 border border-gray-200/60 backdrop-blur-sm">
                                            {t('status.inactive')}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                    <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                        <Mail size={12} className="text-gray-400" /> {admin.email}
                                    </span>
                                    {admin.mobile && (
                                        <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                            <Phone size={12} className="text-gray-400" /> {admin.mobile}
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                        <Building2 size={12} className="text-gray-400" /> {admin.centre_name}
                                    </span>
                                </div>
                            </div>

                            {admin.admin_id !== user?.id && (
                                <button
                                    onClick={(e) => handleToggleStatus(e, admin)}
                                    disabled={togglingId === admin.admin_id}
                                    title={admin.is_active ? t('adminList.deactivateTitle') : t('adminList.reactivateTitle')}
                                    className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200 backdrop-blur-sm shadow-sm relative z-10
                                        ${admin.is_active
                                            ? 'bg-rose-50/80 text-rose-600 border border-rose-200/60 hover:bg-rose-100/80'
                                            : 'bg-emerald-50/80 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100/80'}`}>
                                    <Power size={12} />
                                    {admin.is_active ? t('adminList.deactivateButton') : t('adminList.reactivateButton')}
                                </button>
                            )}

                            <ChevronRight size={18} className="text-gray-300 shrink-0 relative z-10" />
                        </div>
                    ))}
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('adminList.footerTotal', { defaultValue: 'Total admins' })}: <strong className="text-gray-600">{admins.length}</strong></span>
                    <span>· {t('adminList.footerActive', { defaultValue: 'Active' })}: <strong className="text-emerald-600">{activeCount}</strong></span>
                    <span>· {t('adminList.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
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