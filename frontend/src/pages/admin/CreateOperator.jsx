import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    UserPlus, ArrowLeft, BadgeCheck, AlertTriangle,
    Mail, Phone, Lock, Eye, EyeOff, X,
    Home, Settings,
} from 'lucide-react';
import api from '../../api/axios';
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

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
            className={`border bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                ${error ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200/60'}`}
        />
        {error && <p className="text-[10px] text-rose-500">{error}</p>}
        {hint && !error && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
);

// ── Main ──────────────────────────────────────────────────────
export default function CreateOperator() {
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

    const startCreateOperatorTour = () => {
        const driverObj = driver({
            showProgress: true,
            allowClose: true,
            steps: [
                {
                    element: '[data-tour="basic-info"]',
                    popover: { title: t('createOperator.pageTitle'), description: 'Enter the operator\'s name, email, and mobile number.' },
                },
                {
                    element: '[data-tour="password-section"]',
                    popover: { title: t('createOperator.loginCredentials'), description: 'Set a password the operator will use to log in.' },
                },
                {
                    element: '[data-tour="submit-btn"]',
                    popover: { title: t('createOperator.createOperator'), description: 'Click here to create the new operator account.' },
                },
            ],
        });
        driverObj.drive();
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
        if (form.name.trim().length < 2) errs.name = t('createOperator.nameMinLength');
        if (!form.email.trim()) errs.email = t('createOperator.emailRequired');
        if (form.mobile && !/^[6-9]\d{9}$/.test(form.mobile)) errs.mobile = t('createOperator.invalidMobile');
        if (!form.password) errs.password = t('createOperator.passwordRequired');
        else if (form.password.length < 6) errs.password = t('createOperator.passwordMinLength');
        if (form.password !== form.confirmPassword) errs.confirmPassword = t('createOperator.passwordMismatch');
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
            const { data } = await api.post('/operators', {
                name: form.name.trim(),
                email: form.email.trim(),
                mobile: form.mobile,
                password: form.password,
            });
            showFlash('success', t('createOperator.createSuccess', { name: data.name }));
            setForm({ name: '', email: '', mobile: '', password: '', confirmPassword: '' });
            setFieldErrors({});
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('createOperator.createError'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('createOperator.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('createOperator.pageSubtitle')} —{' '}
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <button
                            type="button"
                            onClick={startCreateOperatorTour}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <BadgeCheck size={15} /> {t('createOperator.startTour') || 'Take a Tour'}
                        </button>
                        <Link
                            to="/admin/operatorlist"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-white/60 backdrop-blur-sm border border-gray-200/60 text-gray-600 hover:bg-gray-50/80 transition shadow-sm"
                        >
                            <ArrowLeft size={15} /> {t('createOperator.backToOperators')}
                        </Link>
                    </div>
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-medium backdrop-blur-sm shadow-sm
                        ${flash.type === 'success'
                            ? 'bg-emerald-50/80 border border-emerald-200/60 text-emerald-700'
                            : 'bg-rose-50/80 border border-rose-200/60 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={18} /> : <BadgeCheck size={18} />}
                        <span className="flex-1">{flash.msg}</span>
                        {flash.type === 'success' && (
                            <Link to="/admin/operators" className="text-xs underline underline-offset-2 hover:no-underline">
                                {t('createOperator.viewAllOperators')}
                            </Link>
                        )}
                        <button
                            onClick={() => setFlash(null)}
                            className="ml-2 opacity-50 hover:opacity-100 transition"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* ── Form Card ── */}
                <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden">

                    {/* Section: Basic Info */}
                    <div className="px-6 py-5 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50" data-tour="basic-info">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                            <UserPlus size={13} className="inline mr-2" /> {t('createOperator.basicInfo')}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Field
                                label={t('createOperator.fullName')}
                                name="name"
                                value={form.name}
                                onChange={handleChange}
                                required
                                placeholder={t('createOperator.namePlaceholder')}
                                error={fieldErrors.name}
                                t={t}
                            />
                            <Field
                                label={t('createOperator.emailAddress')}
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder={t('createOperator.emailPlaceholder')}
                                hint={t('createOperator.emailHint')}
                                error={fieldErrors.email}
                                t={t}
                            />
                            <Field
                                label={t('createOperator.mobileNumber')}
                                name="mobile"
                                type="tel"
                                value={form.mobile}
                                onChange={handleChange}
                                placeholder={t('createOperator.mobilePlaceholder')}
                                hint={t('createOperator.mobileHint')}
                                maxLength={10}
                                error={fieldErrors.mobile}
                                t={t}
                            />
                        </div>
                    </div>

                    {/* Section: Password */}
                    <div className="px-6 py-5 border-b border-gray-200/60" data-tour="password-section">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
                            <Lock size={13} className="inline mr-2" /> {t('createOperator.loginCredentials')}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                            {/* Password */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('createOperator.password')} <span className="text-rose-400">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        name="password"
                                        type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={handleChange}
                                        placeholder={t('createOperator.passwordPlaceholder')}
                                        className={`w-full border bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 pr-14 text-sm text-gray-700 shadow-sm
                                            placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                                            ${fieldErrors.password ? 'border-rose-300 bg-rose-50/50' : 'border-gray-200/60'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(p => !p)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                    >
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                {fieldErrors.password && <p className="text-[10px] text-rose-500">{fieldErrors.password}</p>}
                            </div>

                            {/* Confirm Password */}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {t('createOperator.confirmPassword')} <span className="text-rose-400">*</span>
                                </label>
                                <input
                                    name="confirmPassword"
                                    type={showPass ? 'text' : 'password'}
                                    value={form.confirmPassword}
                                    onChange={handleChange}
                                    placeholder={t('createOperator.confirmPlaceholder')}
                                    className={`w-full border bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                        placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition
                                        ${fieldErrors.confirmPassword || (form.confirmPassword && form.password !== form.confirmPassword)
                                            ? 'border-rose-300 bg-rose-50/50'
                                            : 'border-gray-200/60'}`}
                                />
                                {(fieldErrors.confirmPassword || (form.confirmPassword && form.password !== form.confirmPassword)) && (
                                    <p className="text-[10px] text-rose-500">
                                        {fieldErrors.confirmPassword || t('createOperator.passwordMismatch')}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Info Note */}
                    <div className="px-6 py-3.5 bg-blue-50/80 backdrop-blur-sm border-b border-blue-200/60">
                        <p className="text-xs text-blue-700">
                            <span className="font-semibold">{t('createOperator.note')}:</span> {t('createOperator.infoNote')}
                        </p>
                    </div>

                    {/* Submit Row */}
                    <div className="px-6 py-4 flex items-center justify-between gap-4 bg-gradient-to-r from-gray-50/50 to-white/50">
                        <Link to="/admin/operatorlist" className="text-sm text-gray-500 hover:text-gray-700 transition">
                            ← {t('createOperator.cancel')}
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            data-tour="submit-btn"
                            className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                        >
                            {loading && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            <UserPlus size={15} />
                            {loading ? t('createOperator.creating') : t('createOperator.createOperator')}
                        </button>
                    </div>
                </form>

                {/* Permission Note */}
                <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-amber-100/50 shadow-lg shadow-amber-200/30 px-5 py-3.5">
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/10 blur-3xl" />
                    <p className="text-xs text-amber-700 relative z-10">
                        <span className="font-semibold">{t('createOperator.operatorPermissions')}:</span> {t('createOperator.permissionsNote')}
                    </p>
                </div>

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('createOperator.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                    <span>· {t('createOperator.footerAction', { defaultValue: 'Creating new operator account' })}</span>
                </div>

            </main>
        </div>
    );
}