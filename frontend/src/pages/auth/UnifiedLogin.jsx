import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { User, Lock, Eye, EyeOff, AlertTriangle, Shield, Droplets, BadgeCheck } from 'lucide-react';

const DASHBOARD_BY_ROLE = {
    admin: '/admin/dashboard',
    operator: '/operator/dashboard',
    seller: '/farmer/dashboard',
};

export default function UnifiedLogin() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ identifier: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const [needsSetup, setNeedsSetup] = useState(false);
    const [confirmPassword, setConfirmPassword] = useState('');

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    // Tries each role's login endpoint in turn. Stops at the first one
    // that succeeds (2xx response). Only surfaces an error once every
    // role has rejected the credentials.
    const attemptLogin = async () => {
        const attempts = [
            { role: 'admin', url: '/auth/admin/login', payload: { email: form.identifier, password: form.password } },
            { role: 'operator', url: '/auth/operator/login', payload: { email: form.identifier, password: form.password } },
            { role: 'seller', url: '/auth/seller/login', payload: { identifier: form.identifier, password: form.password } },
        ];

        let lastErrorMsg = 'Login failed';

        for (const attempt of attempts) {
            try {
                const { data } = await api.post(attempt.url, attempt.payload);

                if (attempt.role === 'seller' && data.needsPasswordSetup) {
                    setNeedsSetup(true);
                    return;
                }

                const role = data.role || attempt.role;
                login({ ...data, role });
                navigate(DASHBOARD_BY_ROLE[role] || '/');
                return;
            } catch (err) {
                lastErrorMsg = err.response?.data?.message || lastErrorMsg;
                // try next role
            }
        }

        setError(lastErrorMsg);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await attemptLogin();
        } finally {
            setLoading(false);
        }
    };

    const handleSetPassword = async (e) => {
        e.preventDefault();
        setError('');
        if (form.password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (form.password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const { data } = await api.post('/auth/seller/set-password', {
                identifier: form.identifier,
                password: form.password,
            });
            login({ ...data, role: data.role || 'seller' });
            navigate(DASHBOARD_BY_ROLE.seller);
        } catch (err) {
            setError(err.response?.data?.message || 'Could not set password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center px-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 w-full max-w-md p-8 relative overflow-hidden">
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-400/5 blur-3xl" />
                <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-emerald-400/5 blur-3xl" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-900 to-gray-700 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-gray-900/20">
                            <Droplets size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 leading-none">Dairy Management</p>
                            <p className="text-xs text-gray-500 mt-0.5">Sign in to continue</p>
                        </div>
                    </div>

                    {needsSetup ? (
                        <>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-7 h-7 rounded-full bg-amber-100/80 flex items-center justify-center shrink-0">
                                    <Lock size={14} className="text-amber-600" />
                                </div>
                                <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Set your password
                                </h1>
                            </div>
                            <p className="text-sm text-gray-500 mb-7 pl-9">
                                No password is set on this account yet. Choose one to continue.
                            </p>

                            {error && (
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-600 text-sm font-medium backdrop-blur-sm shadow-sm mb-5">
                                    <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleSetPassword} className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Lock size={12} /> New password
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPass ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={handleChange}
                                            required
                                            minLength={6}
                                            placeholder="At least 6 characters"
                                            className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 pr-16 text-sm
                                                text-gray-700 placeholder:text-gray-300 shadow-sm
                                                focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition"
                                        />
                                        <button type="button" onClick={() => setShowPass(p => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <BadgeCheck size={12} /> Confirm password
                                    </label>
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        placeholder="Re-enter password"
                                        className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm
                                            text-gray-700 placeholder:text-gray-300 shadow-sm
                                            focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:bg-white transition"
                                    />
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 text-white font-bold py-3 rounded-xl
                                        text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-lg shadow-emerald-500/20">
                                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {loading ? 'Saving...' : 'Set Password & Continue'}
                                </button>
                            </form>

                            <button
                                onClick={() => { setNeedsSetup(false); setError(''); }}
                                className="text-sm text-center text-gray-400 hover:text-gray-600 mt-6 w-full transition">
                                ← Back to login
                            </button>
                        </>
                    ) : (
                        <>
                            

                            {error && (
                                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-600 text-sm font-medium backdrop-blur-sm shadow-sm mb-5">
                                    <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-5">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <User size={12} /> Email, mobile number, or name
                                    </label>
                                    <input
                                        name="identifier"
                                        type="text"
                                        value={form.identifier}
                                        onChange={handleChange}
                                        required
                                        placeholder="Enter your email, mobile, or name"
                                        className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm
                                            text-gray-700 placeholder:text-gray-300 shadow-sm
                                            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Lock size={12} /> Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            name="password"
                                            type={showPass ? 'text' : 'password'}
                                            value={form.password}
                                            onChange={handleChange}
                                            required
                                            placeholder="Enter your password"
                                            className="w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 pr-16 text-sm
                                                text-gray-700 placeholder:text-gray-300 shadow-sm
                                                focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition"
                                        />
                                        <button type="button" onClick={() => setShowPass(p => !p)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition">
                                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                        Farmers logging in for the first time: enter your mobile number and any password —
                                        we'll ask you to set one.
                                    </p>
                                </div>

                                <button type="submit" disabled={loading}
                                    className="w-full bg-gradient-to-br from-gray-900 to-gray-800 hover:shadow-xl hover:shadow-gray-900/30 text-white font-bold py-3 rounded-xl
                                        text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-lg shadow-gray-900/20">
                                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {loading ? 'Signing in...' : 'Sign In'}
                                </button>
                            </form>

                            <div className="mt-6 pt-4 border-t border-gray-200/60">
                                <p className="text-sm text-center text-gray-500">
                                    <Link to="/forgot-password" className="text-blue-600 font-semibold hover:text-blue-700 transition">
                                        Forgot password?
                                    </Link>
                                </p>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}