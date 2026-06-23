import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
    Users, Pencil, Trash2, RefreshCw, X, Save,
    AlertTriangle, BadgeCheck, Phone, Mail, Shield,
    ToggleLeft, ToggleRight, Plus, Search,
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
        <input name={name} type={type} value={value} onChange={onChange}
            placeholder={placeholder} required={required}
            className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 text-sm text-gray-900
                placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition" />
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
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-900 flex items-center justify-center shadow-md shadow-gray-200">
                            <Users size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 leading-tight">{t('operators.pageTitle')}</h1>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {t('operators.pageSubtitle')} —{' '}
                                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link to="/admin/operators/new"
                            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-xl bg-black text-white hover:bg-gray-800 transition">
                            <Plus size={13} /> {t('operators.newOperator')}
                        </Link>
                    </div>
                </div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                        { label: t('operators.totalOperators'), value: operators.length, color: 'text-blue-600 bg-blue-50 border-blue-100', icon: <Users size={14} /> },
                        { label: t('operators.active'), value: activeCount, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: <ToggleRight size={14} /> },
                        { label: t('operators.inactive'), value: operators.length - activeCount, color: 'text-rose-600 bg-rose-50 border-rose-100', icon: <ToggleLeft size={14} /> },
                    ].map(({ label, value, color, icon }) => (
                        <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${color}`}>
                            <div className="shrink-0">{icon}</div>
                            <div>
                                <p className="text-xs text-gray-400 leading-none">{label}</p>
                                <p className="text-lg font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Flash ── */}
                {flash && (
                    <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium
                        ${flash.type === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-600'}`}>
                        {flash.type === 'error' ? <AlertTriangle size={15} /> : <BadgeCheck size={15} />}
                        {flash.msg}
                        <button onClick={() => setFlash(null)} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                )}

                {/* ── Edit Form ── */}
                {editingId && (
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div>
                                <h2 className="font-semibold text-gray-800">{t('operators.editOperator')}</h2>
                                <p className="text-xs text-gray-400 mt-0.5">{t('operators.editDesc')}</p>
                            </div>
                            <button onClick={closeEdit}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition">
                                <X size={14} />
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
                                            <label key={val} className={`flex-1 flex items-center justify-center py-2 rounded-xl border cursor-pointer text-xs font-semibold transition
                                                ${editForm.is_active === val
                                                    ? val === 1 ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-700'
                                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
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
                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                                    {t('operators.resetPassword')} <span className="font-normal normal-case text-gray-300">({t('operators.leaveBlankHint')})</span>
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('operators.newPassword')}</label>
                                        <div className="relative">
                                            <input name="password" type={showPass ? 'text' : 'password'}
                                                value={editForm.password} onChange={handleEditChange}
                                                placeholder={t('operators.passwordPlaceholder')}
                                                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-3 py-2 pr-14 text-sm
                                                    focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition placeholder:text-gray-300" />
                                            <button type="button" onClick={() => setShowPass(p => !p)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 hover:text-gray-600 font-semibold">
                                                {showPass ? t('operators.hide') : t('operators.show')}
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('operators.confirmPassword')}</label>
                                        <input name="confirmPassword" type={showPass ? 'text' : 'password'}
                                            value={editForm.confirmPassword} onChange={handleEditChange}
                                            placeholder={t('operators.confirmPlaceholder')}
                                            className={`w-full border bg-gray-50 rounded-xl px-3 py-2 text-sm
                                                focus:outline-none focus:ring-2 focus:ring-black focus:bg-white transition placeholder:text-gray-300
                                                ${editForm.confirmPassword && editForm.password !== editForm.confirmPassword
                                                    ? 'border-rose-300 bg-rose-50' : 'border-gray-200'}`} />
                                        {editForm.confirmPassword && editForm.password !== editForm.confirmPassword && (
                                            <p className="text-[10px] text-rose-500">{t('operators.passwordMismatch')}</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={closeEdit}
                                    className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 transition">{t('operators.cancel')}</button>
                                <button type="submit" disabled={saving}
                                    className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-xl text-white bg-black hover:bg-gray-800 transition disabled:opacity-50">
                                    {saving && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    <Save size={13} />
                                    {saving ? t('operators.saving') : t('operators.updateOperator')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* ── Search ── */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-xs">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input value={search} onChange={e => setSearch(e.target.value)}
                            placeholder={t('operators.searchPlaceholder')}
                            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white
                                focus:outline-none focus:ring-2 focus:ring-black transition placeholder:text-gray-300" />
                    </div>
                    <span className="ml-auto text-xs text-gray-400">
                        {filtered.length} {filtered.length === 1 ? t('operators.operator') : t('operators.operators')}
                    </span>
                </div>

                {/* ── Operator Cards ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-20 bg-white rounded-2xl border border-gray-200">
                        <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-200 gap-2 text-gray-300">
                        <Users size={32} />
                        <p className="text-sm">{t('operators.noOperatorsFound')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filtered.map(op => (
                            <div key={op.operator_id}
                                className={`bg-white rounded-2xl border transition-all group
                                    ${op.is_active ? 'border-gray-200' : 'border-gray-100 opacity-70'}`}>
                                <div className="flex items-center gap-4 px-5 py-4">

                                    {/* Avatar */}
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                                        ${op.is_active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                        {op.name?.charAt(0).toUpperCase()}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="text-sm font-semibold text-gray-800">{op.name}</p>
                                            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border
                                                ${op.is_active
                                                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                    : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                                                {op.is_active ? t('operators.activeBadge') : t('operators.inactiveBadge')}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                <Mail size={10} /> {op.email}
                                            </span>
                                            {op.mobile && (
                                                <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                    <Phone size={10} /> {op.mobile}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 text-[11px] text-gray-400">
                                                <Shield size={10} /> {t('operators.roleOperator')}
                                            </span>
                                            <span className="text-[11px] text-gray-300 font-mono">
                                                {t('operators.joined')} {fmt(op.created_at, t)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button onClick={() => openEdit(op)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-medium transition border border-blue-100">
                                            <Pencil size={11} /> {t('operators.edit')}
                                        </button>
                                        <button onClick={() => setDeleteId(op.operator_id)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-xs font-medium transition border border-red-100">
                                            <Trash2 size={11} /> {t('operators.delete')}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <p className="text-xs text-gray-400">{t('operators.footerNote')}</p>

            </main>

            {/* ── Delete Modal ── */}
            {deleteId && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-80 flex flex-col gap-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                                <Trash2 size={22} className="text-red-500" />
                            </div>
                            <h2 className="text-gray-800 font-semibold text-base">{t('operators.deleteModalTitle')}</h2>
                            <p className="text-gray-400 text-xs leading-relaxed">
                                {t('operators.deleteModalWarning')}
                            </p>
                        </div>
                        <div className="flex gap-2 mt-1">
                            <button onClick={() => setDeleteId(null)}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition">
                                {t('operators.cancel')}
                            </button>
                            <button onClick={handleDelete}
                                className="flex-1 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 shadow-md shadow-red-100 transition active:scale-95">
                                {t('operators.yesDelete')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}