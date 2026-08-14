// pages/admin/MyProfile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, BadgeCheck, AlertTriangle, X, Mail, Phone,
    Building2, Calendar, Save, Eye, EyeOff, ShieldCheck, User,
    Settings, Home,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function MyProfile() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [admin, setAdmin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState(null);
    const [showPass, setShowPass] = useState(false);

    const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '' });

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchMyProfile = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/admin-management/${user.id}`);
            setAdmin(data);
            setForm({ name: data.name, email: data.email, mobile: data.mobile || '', password: '' });
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('myProfile.loadError', { defaultValue: 'Could not load your profile.' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (user?.id) fetchMyProfile(); }, [user?.id]);

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

            const { data } = await api.put(`/admin-management/${user.id}`, payload);
            setAdmin(data);
            setForm(f => ({ ...f, password: '' }));
            showFlash('success', t('myProfile.updateSuccess', { defaultValue: 'Profile updated successfully.' }));
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('myProfile.updateError', { defaultValue: 'Could not update profile.' }));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
            </div>
        );
    }

    if (!admin) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex flex-col items-center justify-center gap-3 text-gray-400">
                <AlertTriangle size={28} />
                <p className="text-sm">{t('myProfile.notFound', { defaultValue: 'Profile not found.' })}</p>
                <button
                    onClick={() => navigate('/admin/dashboard')}
                    className="text-blue-600 text-sm font-medium hover:underline"
                >
                    {t('myProfile.backToDashboard', { defaultValue: 'Back to Dashboard' })}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* Top bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('myProfile.pageTitle', { defaultValue: 'My Profile' })}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('myProfile.title', { defaultValue: 'Administrator Profile' })}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/admin/dashboard')}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                    >
                        <ArrowLeft size={16} />
                        {t('myProfile.backToDashboard', { defaultValue: 'Back to Dashboard' })}
                    </button>
                </div>

                {/* Flash message */}
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

                {/* Profile Header Card */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-200/50 p-6 flex items-center gap-5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0 relative z-10
                        ${admin.is_active
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                            : 'bg-gradient-to-br from-gray-400 to-gray-500 text-white shadow-lg shadow-gray-400/30'}`}>
                        {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 relative z-10">
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h1 className="text-xl font-bold text-gray-900 truncate">{admin.name}</h1>
                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 border border-blue-200/60 backdrop-blur-sm">
                                {t('myProfile.youBadge', { defaultValue: 'You' })}
                            </span>
                            <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm
                                ${admin.is_active
                                    ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60'
                                    : 'bg-gray-100/80 text-gray-500 border-gray-200/60'}`}>
                                {admin.is_active ? t('status.active') : t('status.inactive')}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1.5"><Mail size={14} className="text-gray-400" /> {admin.email}</span>
                            {admin.mobile && <span className="flex items-center gap-1.5"><Phone size={14} className="text-gray-400" /> {admin.mobile}</span>}
                            <span className="flex items-center gap-1.5"><Building2 size={14} className="text-gray-400" /> {admin.centre_name}</span>
                            <span className="flex items-center gap-1.5">
                                <Calendar size={14} className="text-gray-400" />
                                {t('adminProfile.joinedLabel')} {new Date(admin.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Role info card */}
                <div className="relative overflow-hidden rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-indigo-100/50 shadow-lg shadow-indigo-200/30 p-5 flex items-center gap-4">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-indigo-400/10 blur-3xl" />
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0 relative z-10">
                        <ShieldCheck size={20} className="text-white" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-sm font-bold text-gray-800">
                            {t('myProfile.roleTitle', { defaultValue: 'Administrator Account' })}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('myProfile.roleDesc', { defaultValue: 'You have full administrative access to this centre.' })}
                        </p>
                    </div>
                </div>

                {/* Edit form */}
                <form onSubmit={handleSave} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-6 flex flex-col gap-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 flex items-center justify-center shadow-lg shadow-gray-900/20">
                            <User size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">{t('myProfile.editTitle', { defaultValue: 'Edit Your Profile' })}</p>
                            <p className="text-xs text-gray-500">{t('myProfile.editSubtitle', { defaultValue: 'Update your personal information' })}</p>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('adminProfile.fullName')}</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('adminProfile.email')}</label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('adminProfile.mobile')}</label>
                            <input
                                name="mobile"
                                type="tel"
                                value={form.mobile}
                                onChange={handleChange}
                                pattern="^\+?[0-9]{10,15}$"
                                placeholder={t('adminProfile.mobilePlaceholder')}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                {t('adminProfile.newPassword')}
                                <span className="text-gray-400 font-normal lowercase tracking-normal ml-1">{t('adminProfile.leaveBlankHint')}</span>
                            </label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPass ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    placeholder={t('adminProfile.passwordPlaceholder')}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-700 w-full
                                        focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-gray-100/60">
                        <button
                            type="submit"
                            disabled={saving}
                            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={16} />}
                            {saving ? t('adminProfile.saving') : t('adminProfile.saveChanges')}
                        </button>
                    </div>
                </form>

                {/* Self-account notice */}
                <div className="relative overflow-hidden rounded-2xl border border-gray-200/60 bg-gradient-to-br from-gray-50 to-gray-100/50 shadow-sm p-4 text-xs text-gray-500 flex items-center gap-2.5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />
                    <AlertTriangle size={14} className="text-gray-400 shrink-0 relative z-10" />
                    <span className="relative z-10">{t('adminProfile.selfDeactivateWarning')}</span>
                </div>

                {/* Footer */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('myProfile.footerProfile', { defaultValue: 'Profile management' })}</span>
                    <span>· {t('myProfile.footerLastLogin', { defaultValue: 'Last login' })}: {admin.last_login ? new Date(admin.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('myProfile.firstLogin', { defaultValue: 'First login' })}</span>
                    <span>· {t('myProfile.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{admin.role || 'Administrator'}</strong></span>
                </div>
            </main>
        </div>
    );
}