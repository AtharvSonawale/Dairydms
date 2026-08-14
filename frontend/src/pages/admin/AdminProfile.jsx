// pages/admin/AdminProfile.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, BadgeCheck, AlertTriangle, X, Mail, Phone,
    Building2, Calendar, Power, Trash2, Save, Eye, EyeOff,
    Home, UserCog
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

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

export default function AdminProfile() {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [showPass, setShowPass] = useState(false);
    const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);

    const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '' });

    const isSelf = admin && admin.admin_id === user?.id;

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchAdmin = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/admin-management/${id}`);
            setAdmin(data);
            setForm({ name: data.name, email: data.email, mobile: data.mobile || '', password: '' });
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('adminProfile.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAdmin(); }, [id]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                name: form.name,
                email: form.email,
                mobile: form.mobile,
                is_active: admin.is_active,
            };
            if (form.password) payload.password = form.password;

            const { data } = await api.put(`/admin-management/${id}`, payload);
            setAdmin(data);
            setForm(f => ({ ...f, password: '' }));
            showFlash('success', t('adminProfile.updateSuccess'));
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('adminProfile.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async () => {
        try {
            const { data } = await api.patch(`/admin-management/${id}/status`, {
                is_active: admin.is_active ? 0 : 1,
            });
            setAdmin(prev => ({ ...prev, is_active: data.is_active }));
            showFlash('success', t(`adminProfile.statusToggle.${data.is_active ? 'reactivated' : 'deactivated'}`));
            setDeactivateConfirmOpen(false);
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('adminProfile.statusToggleError'));
            setDeactivateConfirmOpen(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
            </div>
        );
    }

    if (!admin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex flex-col items-center justify-center gap-3 text-gray-400">
                <AlertTriangle size={28} />
                <p className="text-sm">{t('adminProfile.notFound')}</p>
                <Link to="/admin/admins" className="text-blue-600 text-sm font-medium hover:underline">
                    {t('adminProfile.backToList')}
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('adminProfile.pageTitle')}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white text-xs font-semibold shadow-md shadow-blue-500/30">
                                <UserCog size={12} /> {t('adminProfile.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('adminProfile.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('adminProfile.pageSubtitle')}
                        </p>
                    </div>

                    <button onClick={() => navigate('/admin/admins')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm self-start sm:self-auto">
                        <ArrowLeft size={15} /> {t('adminProfile.backToList')}
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
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100 transition">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Header card ── */}
                <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-6 flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 shadow-lg
                        ${admin.is_active
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/20'
                            : 'bg-gray-100/80 text-gray-400 border border-gray-200/60'}`}>
                        {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg font-bold text-gray-900 truncate">{admin.name}</h1>
                            {isSelf && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50/80 text-blue-600 border border-blue-200/60">
                                    {t('adminProfile.youBadge')}
                                </span>
                            )}
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                ${admin.is_active
                                    ? 'bg-emerald-50/80 text-emerald-600 border-emerald-200/60'
                                    : 'bg-gray-100/80 text-gray-500 border-gray-200/60'}`}>
                                {admin.is_active ? t('status.active') : t('status.inactive')}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Mail size={11} /> {admin.email}</span>
                            {admin.mobile && <span className="flex items-center gap-1"><Phone size={11} /> {admin.mobile}</span>}
                            <span className="flex items-center gap-1"><Building2 size={11} /> {admin.centre_name}</span>
                            <span className="flex items-center gap-1">
                                <Calendar size={11} /> {t('adminProfile.joinedLabel')} {new Date(admin.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* ── Edit form ── */}
                <SectionCard
                    title={t('adminProfile.editTitle')}
                    icon={<UserCog size={16} className="text-white" />}
                >
                    <form onSubmit={handleSave} className="flex flex-col gap-5">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('adminProfile.fullName')} <span className="text-rose-400">*</span></label>
                                <input name="name" value={form.name} onChange={handleChange} required
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm text-gray-900
                                        focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('adminProfile.email')} <span className="text-rose-400">*</span></label>
                                <input name="email" type="email" value={form.email} onChange={handleChange} required
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm text-gray-900
                                        focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{t('adminProfile.mobile')}</label>
                                <input name="mobile" type="tel" value={form.mobile} onChange={handleChange}
                                    pattern="^\+?[0-9]{10,15}$" placeholder={t('adminProfile.mobilePlaceholder')}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 text-sm text-gray-900
                                        focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                    {t('adminProfile.newPassword')} <span className="text-gray-400 font-normal">{t('adminProfile.leaveBlankHint')}</span>
                                </label>
                                <div className="relative">
                                    <input name="password" type={showPass ? 'text' : 'password'}
                                        value={form.password} onChange={handleChange}
                                        placeholder={t('adminProfile.passwordPlaceholder')}
                                        className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-3 py-2.5 pr-10 text-sm text-gray-900 w-full
                                            focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm" />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-2">
                            <button type="submit" disabled={saving}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50">
                                {saving
                                    ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    : <Save size={14} />}
                                {saving ? t('adminProfile.saving') : t('adminProfile.saveChanges')}
                            </button>
                        </div>
                    </form>
                </SectionCard>

                {/* ── Danger zone ── */}
                {!isSelf && (
                    <SectionCard
                        title={admin.is_active ? t('adminProfile.deactivateTitle') : t('adminProfile.reactivateTitle')}
                        icon={<Power size={16} className="text-white" />}
                    >
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <p className="text-xs text-gray-400">
                                    {admin.is_active ? t('adminProfile.deactivateDesc') : t('adminProfile.reactivateDesc')}
                                </p>
                            </div>
                            <button onClick={() => setDeactivateConfirmOpen(true)}
                                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm
                                    ${admin.is_active
                                        ? 'bg-rose-50/80 text-rose-600 border border-rose-200/60 hover:bg-rose-100/80'
                                        : 'bg-emerald-50/80 text-emerald-600 border border-emerald-200/60 hover:bg-emerald-100/80'}`}>
                                <Power size={14} /> {admin.is_active ? t('adminProfile.deactivateButton') : t('adminProfile.reactivateButton')}
                            </button>
                        </div>
                    </SectionCard>
                )}
                {isSelf && (
                    <div className="bg-gray-50/60 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-4 text-xs text-gray-400 flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-500" />
                        {t('adminProfile.selfDeactivateWarning')}
                    </div>
                )}
            </main>

            {/* ── Confirm modal ── */}
            {deactivateConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 w-full max-w-sm">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200/60">
                            <div className="w-9 h-9 rounded-full bg-rose-100/80 flex items-center justify-center shrink-0">
                                <Trash2 size={16} className="text-rose-600" />
                            </div>
                            <h2 className="text-sm font-bold text-gray-900">
                                {admin.is_active ? t('adminProfile.confirmDeactivate') : t('adminProfile.confirmReactivate')}
                            </h2>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-gray-600">
                                {t('adminProfile.confirmMessage', {
                                    action: admin.is_active ? t('adminProfile.deactivateAction') : t('adminProfile.reactivateAction'),
                                    name: admin.name
                                })}
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200/60">
                            <button onClick={() => setDeactivateConfirmOpen(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-gray-200/60 bg-white/60 backdrop-blur-sm text-gray-600 hover:bg-gray-50/80 transition shadow-sm">
                                {t('adminProfile.cancel')}
                            </button>
                            <button onClick={handleToggleStatus}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-rose-600 to-rose-700 text-white hover:shadow-lg hover:shadow-rose-500/30 transition shadow-sm">
                                <Power size={12} /> {t('adminProfile.confirmYes', { action: admin.is_active ? t('adminProfile.deactivateAction') : t('adminProfile.reactivateAction') })}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}