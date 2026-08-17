import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/axios';
import {
    User, Lock, Eye, EyeOff, AlertTriangle,
    Check, ArrowLeft, Mail, Shield, Droplets,
    BadgeCheck, X
} from 'lucide-react';

export default function ForgotPassword() {
    const [step, setStep] = useState("email"); // "email" | "otp" | "reset" | "done"
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setStep('otp');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to send OTP. Check your email.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await api.post('/auth/verify-otp', { email, otp });
            setStep('reset');
        } catch (err) {
            setError(err.response?.data?.message || 'Invalid or expired OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');
        if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
        if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
        setLoading(true);
        try {
            await api.post('/auth/reset-password', { email, otp, password });
            setStep('done');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const inputClass = "w-full border border-gray-200/60 bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2.5 text-sm text-gray-700 placeholder:text-gray-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition";

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100/50 flex items-center justify-center px-4">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-200/50 w-full max-w-md p-8 relative overflow-hidden">
                {/* Decorative blur elements */}
                <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-400/5 blur-3xl" />
                <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-indigo-400/5 blur-3xl" />

                <div className="relative z-10">
                    {/* Logo */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/30">
                            <Droplets size={20} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 leading-none">Dairy Management</p>
                            <p className="text-xs text-gray-500 mt-0.5">Password Recovery</p>
                        </div>
                    </div>

                    {/* Step indicator */}
                    <div className="flex items-center gap-2 mb-6">
                        {["email", "otp", "reset"].map((s, i) => (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition border-2
                                    ${step === s || (step === "done" && i === 2)
                                        ? "bg-gradient-to-br from-blue-500 to-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/30"
                                        : ["otp", "reset", "done"].indexOf(step) > i
                                            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                                            : "bg-white/50 border-gray-200/60 text-gray-400"}`}>
                                    {["otp", "reset", "done"].indexOf(step) > i ? <Check size={12} /> : i + 1}
                                </div>
                                {i < 2 && <div className={`flex-1 h-px w-8 ${["otp", "reset", "done"].indexOf(step) > i ? "bg-emerald-400" : "bg-gray-200"}`} />}
                            </div>
                        ))}
                        <span className="text-xs font-bold text-gray-400 ml-1">
                            {step === "email" ? "Email" : step === "otp" ? "OTP" : step === "reset" ? "Password" : "Done"}
                        </span>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/60 text-rose-600 text-sm font-medium backdrop-blur-sm shadow-sm mb-5">
                            <AlertTriangle size={16} className="text-rose-500 shrink-0" />
                            <p>{error}</p>
                            <button onClick={() => setError('')} className="ml-auto opacity-50 hover:opacity-100 transition">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Step: Email */}
                    {step === "email" && (
                        <>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-7 h-7 rounded-full bg-blue-100/80 flex items-center justify-center shrink-0">
                                    <Mail size={14} className="text-blue-600" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Forgot password?
                                </h1>
                            </div>
                            <p className="text-sm text-gray-500 mb-5 pl-9">Enter your registered email and we'll send you a reset OTP.</p>
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <User size={12} /> Email
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        placeholder="Enter your email"
                                        className={inputClass}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:shadow-xl hover:shadow-blue-500/30 text-white font-bold py-2.5 rounded-xl
                                        text-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                >
                                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {loading ? 'Sending OTP...' : 'Send OTP'}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step: OTP */}
                    {step === "otp" && (
                        <>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-7 h-7 rounded-full bg-amber-100/80 flex items-center justify-center shrink-0">
                                    <Shield size={14} className="text-amber-600" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Check your email
                                </h1>
                            </div>
                            <p className="text-sm text-gray-500 mb-5 pl-9">
                                We sent a 6-digit OTP to <strong className="text-gray-700">{email}</strong>. Enter it below.
                            </p>
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Shield size={12} /> OTP Code
                                    </label>
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={6}
                                        value={otp}
                                        onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                        required
                                        placeholder="Enter 6-digit OTP"
                                        className={`${inputClass} tracking-[0.3em] text-center text-lg font-bold`}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || otp.length < 6}
                                    className="w-full bg-gradient-to-br from-amber-500 to-amber-600 hover:shadow-xl hover:shadow-amber-500/30 text-white font-bold py-2.5 rounded-xl
                                        text-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                                >
                                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {loading ? 'Verifying...' : 'Verify OTP'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                                    className="w-full text-sm font-medium text-gray-400 hover:text-gray-600 transition flex items-center justify-center gap-1.5"
                                >
                                    <ArrowLeft size={14} /> Use a different email
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step: Reset */}
                    {step === "reset" && (
                        <>
                            <div className="flex items-center gap-2.5 mb-1">
                                <div className="w-7 h-7 rounded-full bg-emerald-100/80 flex items-center justify-center shrink-0">
                                    <Lock size={14} className="text-emerald-600" />
                                </div>
                                <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Set new password
                                </h1>
                            </div>
                            <p className="text-sm text-gray-500 mb-5 pl-9">Choose a strong password for your account.</p>
                            <form onSubmit={handleResetPassword} className="space-y-4">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Lock size={12} /> New Password
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showPass ? 'text' : 'password'}
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            required
                                            placeholder="At least 6 characters"
                                            className={`${inputClass} pr-16`}
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
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <BadgeCheck size={12} /> Confirm Password
                                    </label>
                                    <input
                                        type="password"
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                        required
                                        placeholder="Repeat your password"
                                        className={inputClass}
                                    />
                                    {confirmPassword && password !== confirmPassword && (
                                        <p className="text-xs text-rose-500 font-medium mt-0.5 flex items-center gap-1.5">
                                            <AlertTriangle size={12} /> Passwords do not match
                                        </p>
                                    )}
                                    {confirmPassword && password === confirmPassword && password.length >= 6 && (
                                        <p className="text-xs text-emerald-500 font-medium mt-0.5 flex items-center gap-1.5">
                                            <BadgeCheck size={12} /> Passwords match ✓
                                        </p>
                                    )}
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || password !== confirmPassword || password.length < 6}
                                    className="w-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:shadow-xl hover:shadow-emerald-500/30 text-white font-bold py-2.5 rounded-xl
                                        text-sm transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                                >
                                    {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                                    {loading ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </form>
                        </>
                    )}

                    {/* Step: Done */}
                    {step === "done" && (
                        <div className="text-center py-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/30">
                                <Check size={28} className="text-white" />
                            </div>
                            <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1">
                                Password reset!
                            </h1>
                            <p className="text-sm text-gray-500 mb-6">Your password has been updated successfully. You can now sign in.</p>
                            <Link to="/"
                                className="inline-flex items-center justify-center w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:shadow-xl hover:shadow-blue-500/30 text-white font-bold py-2.5 rounded-xl text-sm transition shadow-lg shadow-blue-500/20">
                                Back to Sign In
                            </Link>
                        </div>
                    )}

                    {step !== "done" && (
                        <div className="mt-6 pt-4 border-t border-gray-200/60">
                            <p className="text-sm text-center text-gray-500">
                                Remember it?{' '}
                                <Link to="/" className="text-blue-600 font-semibold hover:text-blue-700 transition">
                                    Sign in
                                </Link>
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}