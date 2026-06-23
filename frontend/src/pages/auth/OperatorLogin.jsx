import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';

export default function OperatorLogin() {
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
            const { data } = await api.post('/auth/operator/login', form);
            login(data);
            navigate('/operator/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    // REPLACE WITH:
    return (
        <div className="min-h-screen bg-[#f5f4f0] flex items-center justify-center px-4"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');`}</style>

            <div className="bg-white rounded-2xl border border-gray-200 w-full max-w-md p-8 shadow-sm">

                {/* Logo */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                        <span className="text-white text-sm font-bold">D</span>
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-900 leading-none">Dairy Management</p>
                        <p className="text-xs text-gray-400 mt-0.5">Operator Portal</p>
                    </div>
                </div>

                <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
                <p className="text-sm text-gray-500 mb-7">Sign in to your operator account</p>

                {error && (
                    <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3 mb-5">
                        <span className="text-rose-400 text-sm">⚠</span>
                        <p className="text-sm text-rose-700">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <input name="email" type="email" value={form.email} onChange={handleChange} required                            placeholder="Enter your email"
                            className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 text-sm
        placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium text-gray-700">Password</label>
                        <div className="relative">
                            <input name="password" type={showPass ? 'text' : 'password'} value={form.password} onChange={handleChange} required
                                placeholder="Enter your password"
                                className="w-full border border-gray-200 bg-gray-50 rounded-xl px-4 py-2.5 pr-16 text-sm
                placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition" />
                            <button type="button" onClick={() => setShowPass(p => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 font-medium">
                                {showPass ? 'Hide' : 'Show'}
                            </button>
                        </div>
                    </div>

                    <button type="submit" disabled={loading}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-xl
                        text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2">
                        {loading && (
                            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="text-sm text-center text-gray-400 mt-5">
                    <Link to="/forgot-password" className="text-emerald-600 hover:underline">Forgot password?</Link>
                </p>
                <p className="text-sm text-center text-gray-400 mt-3">
                    Admin?{' '}
                    <Link to="/" className="text-emerald-600 font-medium hover:underline">
                        Login here
                    </Link>
                </p>
            </div>
        </div>
    );
}