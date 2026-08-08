// pages/admin/MyProfile.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, BadgeCheck, AlertTriangle, X, Mail, Phone,
    Building2, Calendar, Save, Eye, EyeOff, ShieldCheck, User,
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
            <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
            </div>
        );
    }

    if (!admin) {
        return (
            <div className="min-h-screen bg-[#f5f4f0] flex flex-col items-center justify-center gap-3 text-gray-400">
                <AlertTriangle size={28} />
                <p className="text-sm">{t('myProfile.notFound', { defaultValue: 'Profile not found.' })}</p>
                <button onClick={() => navigate('/admin/dashboard')} className="text-blue-600 text-sm font-medium hover:underline">
                    {t('myProfile.backToDashboard', { defaultValue: 'Back to Dashboard' })}
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Back link */}
                <button onClick={() => navigate('/admin/dashboard')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition self-start">
                    <ArrowLeft size={14} /> {t('myProfile.backToDashboard', { defaultValue: 'Back to Dashboard' })}
                </button>

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

                {/* Header card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shrink-0
                        ${admin.is_active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'}`}>
                        {admin.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-lg font-bold text-gray-900 truncate">{admin.name}</h1>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                {t('myProfile.youBadge', { defaultValue: 'You' })}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                ${admin.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
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

                {/* Role info card */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                        <ShieldCheck size={18} />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-800">
                            {t('myProfile.roleTitle', { defaultValue: 'Administrator Account' })}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {t('myProfile.roleDesc', { defaultValue: 'You have full administrative access to this centre.' })}
                        </p>
                    </div>
                </div>

                {/* Edit form */}
                <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                        <User size={15} className="text-gray-400" />
                        <h2 className="text-sm font-bold text-gray-900">{t('myProfile.editTitle', { defaultValue: 'Edit Your Profile' })}</h2>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">{t('adminProfile.fullName')}</label>
                            <input name="name" value={form.name} onChange={handleChange} required
                                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">{t('adminProfile.email')}</label>
                            <input name="email" type="email" value={form.email} onChange={handleChange} required
                                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">{t('adminProfile.mobile')}</label>
                            <input name="mobile" type="tel" value={form.mobile} onChange={handleChange}
                                pattern="^\+?[0-9]{10,15}$" placeholder={t('adminProfile.mobilePlaceholder')}
                                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">
                                {t('adminProfile.newPassword')} <span className="text-gray-400 font-normal">{t('adminProfile.leaveBlankHint')}</span>
                            </label>
                            <div className="relative">
                                <input name="password" type={showPass ? 'text' : 'password'}
                                    value={form.password} onChange={handleChange}
                                    autoComplete="new-password"
                                    placeholder={t('adminProfile.passwordPlaceholder')}
                                    className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 pr-10 text-sm w-full
                                        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-2">
                        <button type="submit" disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50">
                            {saving
                                ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={14} />}
                            {saving ? t('adminProfile.saving') : t('adminProfile.saveChanges')}
                        </button>
                    </div>
                </form>

                {/* Self-account notice — deactivation isn't available for your own account */}
                <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-xs text-gray-400 flex items-center gap-2">
                    <AlertTriangle size={13} />
                    {t('adminProfile.selfDeactivateWarning')}
                </div>
            </main>
        </div>
    );
}