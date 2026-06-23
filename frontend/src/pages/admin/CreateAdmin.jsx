import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    UserPlus, ArrowLeft, BadgeCheck, AlertTriangle,
    Mail, Phone, Lock, Eye, EyeOff, X, Building2,
} from 'lucide-react';
import api from '../../api/axios';

// ── Field ─────────────────────────────────────────────────────
const Field = ({ label, name, type = 'text', value, onChange, placeholder, hint, required, maxLength, error, t }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
        <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            maxLength={maxLength}
            className={`border bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                ${error ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}
        />
        {error && <p className="text-[10px] text-rose-500">{error}</p>}
        {hint && !error && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
);

// ── Main ──────────────────────────────────────────────────────
export default function CreateAdmin({ currentCentreName }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirmPassword: '' });
    const [fieldErrors, setFieldErrors] = useState({});
    const [flash, setFlash] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        if (type === 'error') setTimeout(() => setFlash(null), 4000);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // only digits for mobile
        if (name === 'mobile' && !/^\d*$/.test(value)) return;
        if (name === 'name' && !/^[a-zA-Z\s]*$/.test(value)) return;
        setForm(p => ({ ...p, [name]: value }));
        setFieldErrors(p => ({ ...p, [name]: '' }));
    };

    const validate = () => {
        const errs = {};
        if (form.name.trim().length < 2) errs.name = t('createAdmin.nameMinLength');
        if (!form.email.trim()) errs.email = t('createAdmin.emailRequired');
        if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) errs.mobile = t('createAdmin.invalidMobile');
        if (!form.password) errs.password = t('createAdmin.passwordRequired');
        else if (form.password.length < 6) errs.password = t('createAdmin.passwordMinLength');
        if (form.password !== form.confirmPassword) errs.confirmPassword = t('createAdmin.passwordMismatch');
        return errs;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFlash(null);
        const errs = validate();
        if (Object.keys(errs).length) {
            setFieldErrors(errs);
            return;
        }

        setLoading(true);
        try {
            // NOTE: no centre_id / dairy_id is ever sent from the client.
            // The backend resolves the new admin's centre strictly from the
            // logged-in admin's own JWT (req.user.centre_id) and ignores
            // any centre/dairy value supplied in the request body.
            const { data } = await api.post('/admins', {
                name: form.name.trim(),
                email: form.email.trim(),
                mobile: form.mobile,
                password: form.password,
            });
            showFlash('success', t('createAdmin.createSuccess', { name: data.name }));
            setForm({ name: '', email: '', mobile: '', password: '', confirmPassword: '' });
            setFieldErrors({});
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('createAdmin.createError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <UserPlus size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('createAdmin.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('createAdmin.pageSubtitle')} —{' '}
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>
                    <Link
                        to="/admin/adminlist"
                        className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition self-start sm:self-auto"
                    >
                        <ArrowLeft size={13} /> {t('createAdmin.backToAdmins')}
                    </Link>
                </div>

                {/* ── Centre Context (read-only, not editable, not a form field) ── */}
                {currentCentreName && (
                    <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-white border border-gray-200 text-sm">
                        <Building2 size={15} className="text-gray-400" />
                        <span className="text-gray-500">{t('createAdmin.centreContext')}:</span>
                        <span className="font-semibold text-gray-900">{currentCentreName}</span>
                    </div>
                )}

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                            : 'bg-rose-50 border border-rose-200 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        <span className="flex-1">{flash.msg}</span>
                        {flash.type === 'success' && (
                            <Link to="/admin/adminlist" className="text-xs underline underline-offset-2 hover:no-underline">
                                {t('createAdmin.viewAllAdmins')}
                            </Link>
                        )}
                        <button onClick={() => setFlash(null)} className="ml-2 opacity-50 hover:opacity-100">
                            <X size={14} />
                        </button>
                    </div>
                )}

                {/* ── Form Card ── */}
                <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

                    {/* Section: Basic Info */}
                    <div className="px-6 py-5 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{t('createAdmin.basicInfo')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field
                                label={t('createAdmin.fullName')}
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                placeholder={t('createAdmin.namePlaceholder')}
                                error={fieldErrors.name}
                                t={t}
                            />
                            <Field
                                label={t('createAdmin.emailAddress')}
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder={t('createAdmin.emailPlaceholder')}
                                hint={t('createAdmin.emailHint')}
                                error={fieldErrors.email}
                                t={t}
                            />
                            <Field
                                label={t('createAdmin.mobileNumber')}
                                name="mobile"
                                type="tel"
                                value={form.mobile}
                                onChange={handleChange}
                                placeholder={t('createAdmin.mobilePlaceholder')}
                                hint={t('createAdmin.mobileHint')}
                                maxLength={10}
                                error={fieldErrors.mobile}
                                t={t}
                            />
                        </div>
                    </div>

                    {/* Section: Password */}
                    <div className="px-6 py-5 border-b border-gray-100">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">{t('createAdmin.loginCredentials')}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Password */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('createAdmin.password')} <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        name="password"
                                        type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder={t('createAdmin.passwordPlaceholder')}
                                        className={`w-full border bg-gray-50 rounded-xl px-3 py-2 pr-14 text-sm
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                                            ${fieldErrors.password ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}
                                    />
                                    <button type="button" onClick={() => setShowPass(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                                        {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                                {fieldErrors.password && <p className="text-[10px] text-rose-500">{fieldErrors.password}</p>}
                            </div>

                            {/* Confirm Password */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('createAdmin.confirmPassword')} <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    name="confirmPassword"
                                    type={showPass ? 'text' : 'password'}
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    placeholder={t('createAdmin.confirmPlaceholder')}
                                    className={`w-full border bg-gray-50 rounded-xl px-3 py-2 text-sm
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition
                                        ${fieldErrors.confirmPassword || (form.confirmPassword && form.password !== form.confirmPassword)
                                            ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`}
                                />
                                {(fieldErrors.confirmPassword || (form.confirmPassword && form.password !== form.confirmPassword)) && (
                                    <p className="text-[10px] text-rose-500">
                                        {fieldErrors.confirmPassword || t('createAdmin.passwordMismatch')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="px-6 py-3.5 bg-blue-50 border-b border-blue-100">
                        <p className="text-xs text-blue-700">
                            <span className="font-semibold">{t('createAdmin.note')}:</span> {t('createAdmin.infoNote')}
                        </p>
                    </div>

                    {/* Submit Row */}
                    <div className="px-6 py-4 flex items-center justify-between gap-4">
                        <Link to="/admin/adminlist" className="text-sm text-gray-500 hover:text-gray-700 transition">
                            ← {t('createAdmin.cancel')}
                        </Link>
                        <button type="submit" disabled={loading}
                            className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl text-white bg-black hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            <UserPlus size={13} />
                            {loading ? t('createAdmin.creating') : t('createAdmin.createAdmin')}
                        </button>
                    </div>
                </form>

                {/* Isolation Note */}
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-xs text-amber-700">
                        <span className="font-semibold">{t('createAdmin.centreScope')}:</span> {t('createAdmin.scopeNote')}
                    </p>
                </div>

            </main>
        </div>
    );
}