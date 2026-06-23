// pages/admin/AdminProfile.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    ArrowLeft, BadgeCheck, AlertTriangle, X, Mail, Phone,
    Building2, Calendar, Power, Trash2, Save, Eye, EyeOff,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';

export default function AdminProfile() {
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
            showFlash('error', err.response?.data?.message || 'Failed to load admin.');
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
            showFlash('success', 'Profile updated successfully.');
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to update profile.');
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
            showFlash('success', `Admin ${data.is_active ? 'reactivated' : 'deactivated'} successfully.`);
            setDeactivateConfirmOpen(false);
        } catch (err) {
            showFlash('error', err.response?.data?.message || 'Failed to update status.');
            setDeactivateConfirmOpen(false);
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
                <p className="text-sm">Admin not found.</p>
                <Link to="/admin/admins" className="text-blue-600 text-sm font-medium hover:underline">
                    Back to Admins
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f5f4f0]">
            <main className="max-w-screen-md mx-auto px-4 sm:px-6 py-8 flex flex-col gap-5">

                {/* Back link */}
                <button onClick={() => navigate('/admin/admins')}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition self-start">
                    <ArrowLeft size={14} /> Back to Admins
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
                            {isSelf && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                                    You
                                </span>
                            )}
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full
                                ${admin.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}>
                                {admin.is_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><Mail size={11} /> {admin.email}</span>
                            {admin.mobile && <span className="flex items-center gap-1"><Phone size={11} /> {admin.mobile}</span>}
                            <span className="flex items-center gap-1"><Building2 size={11} /> {admin.centre_name}</span>
                            <span className="flex items-center gap-1">
                                <Calendar size={11} /> Joined {new Date(admin.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Edit form */}
                <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-4">
                    <h2 className="text-sm font-bold text-gray-900">Edit Profile</h2>

                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">Full Name</label>
                            <input name="name" value={form.name} onChange={handleChange} required
                                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">Email</label>
                            <input name="email" type="email" value={form.email} onChange={handleChange} required
                                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">Mobile</label>
                            <input name="mobile" type="tel" value={form.mobile} onChange={handleChange}
                                pattern="^\+?[0-9]{10,15}$" placeholder="+91XXXXXXXXXX"
                                className="border border-gray-200 bg-gray-50 rounded-xl px-3 py-2.5 text-sm
                                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-gray-700">
                                New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
                            </label>
                            <div className="relative">
                                <input name="password" type={showPass ? 'text' : 'password'}
                                    value={form.password} onChange={handleChange}
                                    placeholder="Min 6 characters"
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
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>

                {/* Danger zone */}
                {!isSelf && (
                    <div className="bg-white rounded-2xl border border-rose-100 p-6 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="text-sm font-bold text-rose-700">
                                {admin.is_active ? 'Deactivate this admin' : 'Reactivate this admin'}
                            </h2>
                            <p className="text-xs text-gray-400 mt-0.5">
                                {admin.is_active
                                    ? 'They will no longer be able to log in. Their history is preserved.'
                                    : 'They will regain access to log in.'}
                            </p>
                        </div>
                        <button onClick={() => setDeactivateConfirmOpen(true)}
                            className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition
                                ${admin.is_active
                                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                            <Power size={14} /> {admin.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                    </div>
                )}
                {isSelf && (
                    <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 text-xs text-gray-400 flex items-center gap-2">
                        <AlertTriangle size={13} />
                        You cannot deactivate your own account from here.
                    </div>
                )}
            </main>

            {/* Confirm modal */}
            {deactivateConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-sm">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
                            <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                                <Trash2 size={16} className="text-rose-600" />
                            </div>
                            <h2 className="text-sm font-bold text-gray-900">
                                {admin.is_active ? 'Confirm deactivation' : 'Confirm reactivation'}
                            </h2>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm text-gray-600">
                                Are you sure you want to {admin.is_active ? 'deactivate' : 'reactivate'}{' '}
                                <strong>{admin.name}</strong>?
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
                            <button onClick={() => setDeactivateConfirmOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition">
                                Cancel
                            </button>
                            <button onClick={handleToggleStatus}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition">
                                <Power size={12} /> Yes, {admin.is_active ? 'Deactivate' : 'Reactivate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}