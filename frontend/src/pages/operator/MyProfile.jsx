import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    ArrowLeft, BadgeCheck, AlertTriangle, X, Eye, EyeOff, User, Save,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function OperatorMyProfile() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [operator, setOperator] = useState(null);
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
            const { data } = await api.get('/operators/me');
            setOperator(data);
            setForm({ name: data.name, email: data.email, mobile: data.mobile || '', password: '' });
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('myProfile.loadError', { defaultValue: 'Could not load your profile.' }));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchMyProfile(); }, []);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { name: form.name, email: form.email, mobile: form.mobile };
            if (form.password) payload.password = form.password;

            const { data } = await api.put('/operators/me', payload);
            setOperator(data);
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
                <div className="w-8 h-8 border-3 border-emerald-200 border-t-emerald-700 rounded-full animate-spin" />
            </div>
        );
    }

    if (!operator) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex flex-col items-center justify-center gap-3 text-gray-400">
                <AlertTriangle size={28} />
                <p className="text-sm">{t('myProfile.notFound', { defaultValue: 'Profile not found.' })}</p>
                <button
                    onClick={() => navigate('/operator/dashboard')}
                    className="text-emerald-600 text-sm font-medium hover:underline"
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
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-800 to-emerald-600 bg-clip-text text-transparent">
                            {t('myProfile.operatorTitle', { defaultValue: 'My Profile' })}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {new Date().toLocaleDateString("en-IN", {
                                weekday: "long", day: "numeric", month: "long", year: "numeric",
                            })}
                        </p>
                    </div>

                    <button
                        onClick={() => navigate('/operator/dashboard')}
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

                {/* Read-only centre / admin context */}
                <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/60 text-xs text-gray-600 shadow-sm">
                        <span className="font-semibold text-gray-800">{t('myProfile.centre', { defaultValue: 'Centre' })}:</span>
                        {operator.centre_name} ({operator.centre_code})
                    </div>
                    <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/70 backdrop-blur-sm border border-gray-200/60 text-xs text-gray-600 shadow-sm">
                        <span className="font-semibold text-gray-800">{t('myProfile.reportsTo', { defaultValue: 'Reports to' })}:</span>
                        {operator.admin_name}
                    </div>
                    <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm
                        ${operator.is_active ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700' : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {operator.is_active ? t('status.active', { defaultValue: 'Active' }) : t('status.inactive', { defaultValue: 'Inactive' })}
                    </div>
                </div>

                {/* Edit form */}
                <form onSubmit={handleSave} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-6 flex flex-col gap-5">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-700 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-700/20">
                            <User size={16} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-800">{t('myProfile.editTitle', { defaultValue: 'Edit Your Profile' })}</p>
                            <p className="text-xs text-gray-500">{t('myProfile.editSubtitle', { defaultValue: 'Update your personal information' })}</p>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('adminProfile.fullName', { defaultValue: 'Full Name' })}</label>
                            <input
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                    focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('adminProfile.email', { defaultValue: 'Email' })}</label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                    focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">{t('adminProfile.mobile', { defaultValue: 'Mobile' })}</label>
                            <input
                                name="mobile"
                                type="tel"
                                value={form.mobile}
                                onChange={handleChange}
                                pattern="^\+?[0-9]{10,15}$"
                                placeholder={t('adminProfile.mobilePlaceholder', { defaultValue: 'Enter mobile number' })}
                                className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                                    focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:bg-white transition shadow-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                {t('adminProfile.newPassword', { defaultValue: 'New Password' })}
                                <span className="text-gray-400 font-normal lowercase tracking-normal ml-1">
                                    {t('adminProfile.leaveBlankHint', { defaultValue: '(leave blank to keep current)' })}
                                </span>
                            </label>
                            <div className="relative">
                                <input
                                    name="password"
                                    type={showPass ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={handleChange}
                                    autoComplete="new-password"
                                    placeholder={t('adminProfile.passwordPlaceholder', { defaultValue: '••••••••' })}
                                    className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 pr-10 text-sm text-gray-700 w-full
                                        focus:outline-none focus:ring-2 focus:ring-emerald-600/20 focus:bg-white transition shadow-sm"
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
                            className="flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-emerald-700 to-emerald-600 text-white shadow-lg shadow-emerald-700/30 hover:shadow-xl hover:shadow-emerald-700/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {saving
                                ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                : <Save size={16} />}
                            {saving ? t('adminProfile.saving', { defaultValue: 'Saving...' }) : t('adminProfile.saveChanges', { defaultValue: 'Save Changes' })}
                        </button>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('myProfile.footerProfile', { defaultValue: 'Profile management' })}</span>
                    <span>· {t('myProfile.footerLastLogin', { defaultValue: 'Last login' })}: {operator.last_login ? new Date(operator.last_login).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : t('myProfile.firstLogin', { defaultValue: 'First login' })}</span>
                    <span>· {t('myProfile.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.operator', { defaultValue: 'Operator' })}</strong></span>
                </div>
            </main>
        </div>
    );
}