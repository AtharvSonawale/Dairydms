import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Users, Pencil, Trash2, RefreshCw, X, Save,
    AlertTriangle, BadgeCheck, Phone, Mail, Shield,
    ToggleLeft, ToggleRight, Plus, Search,
    Home, Settings,
} from 'lucide-react';
import api from '../../api/axios';

// ── helpers ──────────────────────────────────────────────────
const fmt = (d, t) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const EMPTY_EDIT = {
    name: '', email: '', mobile: '', is_active: 1,
    password: '', confirmPassword: '',
};

// ── Field ─────────────────────────────────────────────────────
const Field = ({ label, name, type = 'text', value, onChange, placeholder, hint, required, t }) => (
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
            className="border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm"
        />
        {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
);

// ── Main ──────────────────────────────────────────────────────
export default function OperatorList() {
    const { t } = useTranslation();
    const [operators, setOperators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [flash, setFlash] = useState(null);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editForm, setEditForm] = useState(EMPTY_EDIT);
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [showPass, setShowPass] = useState(false);

    const showFlash = (type, msg) => {
        setFlash({ type, msg });
        setTimeout(() => setFlash(null), 3500);
    };

    const fetchOperators = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/operators');
            setOperators(data);
        } catch {
            showFlash('error', t('operators.loadError'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchOperators(); }, [t]);

    const openEdit = (op) => {
        setEditForm({
            name: op.name || '',
            email: op.email || '',
            mobile: op.mobile || '',
            is_active: op.is_active ?? 1,
            password: '',
            confirmPassword: '',
        });
        setEditingId(op.operator_id);
        setShowPass(false);
    };

    const closeEdit = () => { setEditingId(null); setEditForm(EMPTY_EDIT); };

    const handleEditChange = (e) =>
        setEditForm(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSave = async (e) => {
        e.preventDefault();
        if (editForm.password && editForm.password !== editForm.confirmPassword) {
            showFlash('error', t('operators.passwordMismatch')); return;
        }
        if (editForm.password && editForm.password.length < 6) {
            showFlash('error', t('operators.passwordMinLength')); return;
        }
        setSaving(true);
        try {
            const payload = {
                name: editForm.name,
                email: editForm.email,
                mobile: editForm.mobile,
                is_active: editForm.is_active,
            };
            if (editForm.password) payload.password = editForm.password;
            await api.put(`/operators/${editingId}`, payload);
            showFlash('success', t('operators.updateSuccess'));
            await fetchOperators();
            closeEdit();
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('operators.updateError'));
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/operators/${deleteId}`);
            showFlash('success', t('operators.deleteSuccess'));
            await fetchOperators();
        } catch (err) {
            showFlash('error', err.response?.data?.message || t('operators.deleteError'));
        } finally {
            setDeleteId(null);
        }
    };

    const filtered = operators.filter(op =>
        op.name.toLowerCase().includes(search.toLowerCase()) ||
        op.email.toLowerCase().includes(search.toLowerCase()) ||
        (op.mobile || '').includes(search)
    );

    const activeCount = operators.filter(o => o.is_active).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50">
            <main className="max-w-screen mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

                {/* ── Top Bar ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 p-5">
                    <div>
                        <div className="flex items-center gap-2.5 text-sm text-gray-600 mb-1">
                            <Home size={16} className="text-gray-400" />
                            <span>{t('operators.pageBreadcrumb', { defaultValue: 'User Management' })}</span>
                            <span className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white text-xs font-semibold shadow-md shadow-violet-500/30">
                                <Settings size={12} /> {t('status.admin')}
                            </span>
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            {t('operators.pageTitle')}
                        </h1>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {t('operators.pageSubtitle')} —{' '}
                            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>

                    <Link to="/admin/operators/new"
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200"
                    >
                        <Plus size={16} /> {t('operators.newOperator')}
                    </Link>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                        { label: t('operators.totalOperators'), value: operators.length, color: 'from-blue-50 to-blue-100/50 border-blue-200/60 text-blue-700', icon: <Users size={16} /> },
                        { label: t('operators.active'), value: activeCount, color: 'from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700', icon: <ToggleRight size={16} /> },
                        { label: t('operators.inactive'), value: operators.length - activeCount, color: 'from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600', icon: <ToggleLeft size={16} /> },
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

                {/* ── Edit Form ── */}
                {editingId && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-white/50">
                            <div>
                                <h2 className="text-sm font-bold text-gray-800">{t('operators.editOperator')}</h2>
                                <p className="text-xs text-gray-500 mt-0.5">{t('operators.editDesc')}</p>
                            </div>
                            <button
                                onClick={closeEdit}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100/80 hover:bg-gray-200/80 text-gray-500 transition backdrop-blur-sm"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 flex flex-col gap-5">
                            {/* Row 1 */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Field label={t('operators.fullName')} name="name" value={editForm.name}
                                    onChange={handleEditChange} placeholder={t('operators.namePlaceholder')} required t={t} />
                                <Field label={t('operators.email')} name="email" type="email" value={editForm.email}
                                    onChange={handleEditChange} placeholder={t('operators.emailPlaceholder')} required t={t} />
                                <Field label={t('operators.mobile')} name="mobile" type="tel" value={editForm.mobile}
                                    onChange={handleEditChange} placeholder={t('operators.mobilePlaceholder')} t={t} />
                            </div>

                            {/* Row 2 — status toggle */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('operators.status')}</label>
                                    <div className="flex gap-2">
                                        {[{ label: t('operators.activeLabel'), val: 1 }, { label: t('operators.inactiveLabel'), val: 0 }].map(({ label, val }) => (
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2.5 rounded-xl border cursor-pointer text-xs font-semibold transition shadow-sm
                                                ${editForm.is_active === val
                                                    ? val === 1
                                                        ? 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 text-emerald-700'
                                                        : 'bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 text-rose-600'
                                                    : 'bg-white/50 backdrop-blur-sm border-gray-200/60 text-gray-500 hover:border-gray-300 hover:bg-gray-50/50'}`}>
                                                <input type="radio" name="is_active" value={val}
                                                    checked={editForm.is_active === val}
                                                    onChange={() => setEditForm(p => ({ ...p, is_active: val }))}
                                                    className="hidden" />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Row 3 — optional password reset */}
                            <div className="border-t border-gray-200/60 pt-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                                    {t('operators.resetPassword')} <span className="font-normal normal-case text-gray-400">({t('operators.leaveBlankHint')})</span>
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('operators.newPassword')}</label>
                                        <div className="relative">
                                            <input
                                                name="password"
                                                type={showPass ? 'text' : 'password'}
                                                value={editForm.password}
                                                onChange={handleEditChange}
                                                placeholder={t('operators.passwordPlaceholder')}
                                                className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 pr-14 text-sm text-gray-700
                                                    focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm placeholder:text-gray-300"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPass(p => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold transition"
                                            >
                                                {showPass ? t('operators.hide') : t('operators.show')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('operators.confirmPassword')}</label>
                                        <input
                                            name="confirmPassword"
                                            type={showPass ? 'text' : 'password'}
                                            value={editForm.confirmPassword}
                                            onChange={handleEditChange}
                                            placeholder={t('operators.confirmPlaceholder')}
                                            className={`w-full border bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 shadow-sm
                                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition placeholder:text-gray-300
                                                ${editForm.confirmPassword && editForm.password !== editForm.confirmPassword
                                                    ? 'border-rose-300 bg-rose-50/50'
                                                    : 'border-gray-200/60'}`}
                                        />
                                        {editForm.confirmPassword && editForm.password !== editForm.confirmPassword && (
                                            <p className="text-[10px] text-rose-500">{t('operators.passwordMismatch')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-1 border-t border-gray-100/60">
                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition"
                                >
                                    {t('operators.cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex items-center gap-2 text-sm font-semibold px-6 py-2.5 rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 text-white shadow-lg shadow-gray-900/30 hover:shadow-xl hover:shadow-gray-900/40 transition-all duration-200 disabled:opacity-50"
                                >
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    <Save size={14} />
                                    {saving ? t('operators.saving') : t('operators.updateOperator')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── Search ── */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder={t('operators.searchPlaceholder')}
                            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl text-gray-700
                                focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:bg-white transition shadow-sm placeholder:text-gray-300"
                        />
                    </div>
                    <span className="ml-auto text-xs text-gray-400">
                        {filtered.length} {filtered.length === 1 ? t('operators.operator') : t('operators.operators')}
                    </span>
                </div>

                {/* ── Operator Cards ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-20 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50">
                        <div className="w-8 h-8 border-3 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 gap-3 text-gray-300">
                        <Users size={40} className="text-gray-200" />
                        <p className="text-sm font-medium">{t('operators.noOperatorsFound')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filtered.map(op => (
                            <div
                                key={op.operator_id}
                                className={`relative overflow-hidden rounded-2xl border transition-all duration-200 group
                                    ${op.is_active
                                        ? 'bg-white/80 backdrop-blur-sm border-gray-200/60 shadow-lg shadow-gray-200/50 hover:shadow-xl hover:shadow-gray-200/60'
                                        : 'bg-white/50 backdrop-blur-sm border-gray-200/40 shadow-sm opacity-70'}`}
                            >
                                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-gray-400/5 blur-3xl" />

                                <div className="flex items-center gap-4 px-5 py-4 relative z-10">
                                    {/* Avatar */}
                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                        ${op.is_active
                                            ? 'bg-gradient-to-br from-gray-900 to-gray-700 text-white shadow-lg shadow-gray-900/20'
                                            : 'bg-gradient-to-br from-gray-300 to-gray-400 text-white'}`}>
                                        {op.name?.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-bold text-gray-800">{op.name}</p>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full border backdrop-blur-sm
                                                ${op.is_active
                                                    ? 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60'
                                                    : 'bg-gray-100/80 text-gray-500 border-gray-200/60'}`}>
                                                {op.is_active ? t('operators.activeBadge') : t('operators.inactiveBadge')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                                <Mail size={12} className="text-gray-400" /> {op.email}
                                            </span>
                                            {op.mobile && (
                                                <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                                    <Phone size={12} className="text-gray-400" /> {op.mobile}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1.5 text-[11px] text-gray-500">
                                                <Shield size={12} className="text-gray-400" /> {t('operators.roleOperator')}
                                            </span>
                                            <span className="text-[11px] text-gray-400 font-mono">
                                                {t('operators.joined')} {fmt(op.created_at, t)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => openEdit(op)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 text-blue-600 text-xs font-semibold transition border border-blue-200/60 backdrop-blur-sm shadow-sm"
                                        >
                                            <Pencil size={12} /> {t('operators.edit')}
                                        </button>
                                        <button
                                            onClick={() => setDeleteId(op.operator_id)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50/80 hover:bg-rose-100/80 text-rose-500 text-xs font-semibold transition border border-rose-200/60 backdrop-blur-sm shadow-sm"
                                        >
                                            <Trash2 size={12} /> {t('operators.delete')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Footer ── */}
                <div className="flex flex-wrap gap-4 text-xs text-gray-400 pb-2 pt-2 border-t border-gray-200/40">
                    <span>· {t('operators.footerTotal', { defaultValue: 'Total operators' })}: <strong className="text-gray-600">{operators.length}</strong></span>
                    <span>· {t('operators.footerActive', { defaultValue: 'Active' })}: <strong className="text-emerald-600">{activeCount}</strong></span>
                    <span>· {t('operators.footerRole', { defaultValue: 'Role' })}: <strong className="text-gray-600">{t('status.admin')}</strong></span>
                </div>

            </main>

            {/* ── Delete Modal ── */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200/60 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-3 text-center">
                            <div className="w-14 h-14 rounded-full bg-rose-50/80 border border-rose-200/60 flex items-center justify-center shadow-sm">
                                <Trash2 size={24} className="text-rose-500" />
                            </div>
                            <h2 className="text-gray-800 font-bold text-base">{t('operators.deleteModalTitle')}</h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                {t('operators.deleteModalWarning')}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200/60 bg-white/60 backdrop-blur-sm hover:bg-gray-50/80 transition shadow-sm"
                            >
                                {t('operators.cancel')}
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-rose-500 to-rose-600 shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40 transition-all duration-200 active:scale-95"
                            >
                                {t('operators.yesDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}