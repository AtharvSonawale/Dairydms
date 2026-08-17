import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { User, Lock, Eye, EyeOff, AlertTriangle, Shield, Droplets } from 'lucide-react';

export default function AdminLogin() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const { data } = await api.post('/auth/admin/login', form);
            login(data);
            navigate('/admin/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center px-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 w-full max-w-md p-8 relative overflow-hidden">
                {/* Decorative blur elements */}
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-400/5 blur-3xl" />
                <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-indigo-400/5 blur-3xl" />

                <div className="relative z-10">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
                            <Droplets size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 leading-none">Dairy Management</p>
                            <p className="text-xs text-gray-500 mt-0.5">Admin Portal</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 mb-1">
                        <div className="w-7 h-7 rounded-full bg-blue-100/80 flex items-center justify-center shrink-0">
                            <Shield size={14} className="text-blue-600" />
                        </div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                            Welcome back
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 mb-7 pl-9">Sign in to your admin account</p>

                    {error && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-600 text-sm font-medium backdrop-blur-sm shadow-sm mb-5">
                            <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <User size={12} /> Email
                            </label>
                            <input
                                name="email"
                                type="email"
                                value={form.email}
                                onChange={handleChange}
                                required
                                placeholder="Enter your email"
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
                                <button
                                    type="button"
                                    onClick={() => setShowPass(p => !p)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                                >
                                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:shadow-xl hover:shadow-blue-500/30 text-white font-bold py-3 rounded-xl
                                text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-lg shadow-blue-500/20"
                        >
                            {loading && (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            )}
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

                    <div className="mt-4">
                        <p className="text-sm text-center text-gray-500">
                            Operator?{' '}
                            <Link to="/operator/login" className="text-blue-600 font-semibold hover:text-blue-700 transition">
                                Login here
                            </Link>
                        </p>
                        <p className="text-sm text-center text-gray-500">
                            Farmer?{' '}
                            <Link to="/farmer/login" className="text-blue-600 font-semibold hover:text-blue-700 transition">
                                Login here
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}